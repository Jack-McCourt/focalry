<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Meeting;
use App\Models\Order;
use App\Models\PackageBooking;
use App\Models\Project;
use App\Models\SiteLead;
use App\Models\Studio;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Business reporting across every revenue stream the studio runs — CRM invoices,
 * the in-gallery store, and package bookings — plus accounts-receivable health
 * and lead→client conversion. Cash basis: revenue is counted when money is
 * actually collected (payment date), not when an invoice is raised.
 *
 * The Dashboard is a fixed at-a-glance overview; this is the date-range-driven,
 * exportable reporting layer.
 */
class ReportController extends Controller
{
    /** Hard cap so a silly range can't build thousands of month buckets. */
    private const MAX_MONTHS = 60;

    /** Chart colours for expense categories (which have no stored colour). */
    private const PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#6366f1', '#a855f7', '#ec4899', '#64748b'];

    public function index(Request $request): Response
    {
        [$from, $to] = $this->range($request);
        $currency = $this->currency();

        $events = $this->revenueEvents($from, $to);
        $ar = $this->accountsReceivable();
        $expensesByMonth = $this->expensesByMonth($from, $to);
        $expensesTotal = array_sum($expensesByMonth);

        return Inertia::render('Reports/Index', [
            'currency' => $currency,
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'kpis' => $this->kpis($events, $ar, $from, $to),
            'revenueSeries' => $this->revenueSeries($events, $expensesByMonth, $from, $to),
            'revenueBySource' => $this->groupSum($events, 'source'),
            'revenueByType' => $this->revenueByType($events),
            'receivable' => $ar['summary'],
            'overdue' => $ar['overdue'],
            'leads' => $this->leadFunnel($from, $to),
            'pnl' => $this->pnl((int) $events->sum('amount_cents'), $expensesTotal),
            'expensesByCategory' => $this->expensesByCategory($from, $to),
        ]);
    }

    /** Stream the underlying revenue rows for the range as CSV. */
    public function exportRevenue(Request $request): StreamedResponse
    {
        [$from, $to] = $this->range($request);
        $events = $this->revenueEvents($from, $to)->sortBy('date')->values();
        $filename = "revenue_{$from->toDateString()}_{$to->toDateString()}.csv";

        return response()->streamDownload(function () use ($events) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Date', 'Source', 'Reference', 'Client', 'Type', 'Amount']);
            foreach ($events as $e) {
                fputcsv($out, [
                    Carbon::parse($e['date'])->toDateString(),
                    $e['source'],
                    $e['ref'],
                    $e['client'],
                    $e['type_label'],
                    number_format($e['amount_cents'] / 100, 2, '.', ''),
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    /**
     * Every collected-revenue event in the window, normalised across streams.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function revenueEvents(Carbon $from, Carbon $to): Collection
    {
        // CRM invoice payments.
        $invoicePayments = InvoicePayment::query()
            ->whereHas('invoice', fn ($q) => $q->where('status', '!=', 'void'))
            ->whereBetween('paid_on', [$from->toDateString(), $to->toDateString()])
            ->with(['invoice.contact:id,first_name,last_name,company,email', 'invoice.project.type:id,label,color'])
            ->get()
            ->map(function (InvoicePayment $p) {
                $type = $p->invoice?->project?->type;

                return [
                    'date' => Carbon::parse($p->paid_on),
                    'source' => 'Invoices',
                    'amount_cents' => (int) $p->amount_cents,
                    'client' => $p->invoice?->contact?->name ?? '—',
                    'type_label' => $type?->label ?? 'Uncategorised',
                    'type_color' => $type?->color ?? '#9ca3af',
                    'ref' => $p->invoice?->number ?? '',
                ];
            });

        // In-gallery store orders (net of refunds).
        $orders = Order::query()
            ->whereNotNull('paid_at')
            ->whereBetween('paid_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->with('contact:id,first_name,last_name,company,email')
            ->get()
            ->map(fn (Order $o) => [
                'date' => $o->paid_at,
                'source' => 'Store',
                'amount_cents' => (int) $o->total_cents - (int) $o->refunded_cents,
                'client' => $o->contact?->name ?? $o->customer_name ?? '—',
                'type_label' => 'Store',
                'type_color' => '#0ea5e9',
                'ref' => $o->number ?? '',
            ]);

        // Package bookings (paid at checkout — created_at ≈ payment time).
        $bookings = PackageBooking::query()
            ->where('status', 'paid')
            ->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->with(['package:id,name', 'contact:id,first_name,last_name,company,email'])
            ->get()
            ->map(fn (PackageBooking $b) => [
                'date' => $b->created_at,
                'source' => 'Packages',
                'amount_cents' => (int) $b->amount_cents,
                'client' => $b->contact?->name ?? $b->client_name ?? '—',
                'type_label' => 'Packages',
                'type_color' => '#8b5cf6',
                'ref' => $b->package?->name ?? '',
            ]);

        return $invoicePayments->concat($orders)->concat($bookings)->values();
    }

    /**
     * Collected revenue vs expenses per calendar month across the range.
     *
     * @param  array<string, int>  $expensesByMonth
     */
    private function revenueSeries(Collection $events, array $expensesByMonth, Carbon $from, Carbon $to): array
    {
        $buckets = $this->monthBuckets($from, $to);

        foreach ($events as $e) {
            $key = Carbon::parse($e['date'])->format('Y-m');
            if (isset($buckets[$key])) {
                $buckets[$key] += (int) $e['amount_cents'];
            }
        }

        return collect($buckets)->map(function (int $cents, string $key) use ($expensesByMonth) {
            $date = Carbon::createFromFormat('Y-m', $key)->startOfMonth();

            return [
                'key' => $key,
                'label' => $date->format('M'),
                'show_year' => $date->month === 1,
                'year' => $date->format('Y'),
                'collected_cents' => $cents,
                'expenses_cents' => $expensesByMonth[$key] ?? 0,
            ];
        })->values()->all();
    }

    /** @return array<string, int> 'Y-m' => expense cents for each month in range. */
    private function expensesByMonth(Carbon $from, Carbon $to): array
    {
        $buckets = $this->monthBuckets($from, $to);

        Expense::query()
            ->whereBetween('spent_on', [$from->toDateString(), $to->toDateString()])
            ->get(['spent_on', 'amount_cents'])
            ->each(function (Expense $e) use (&$buckets) {
                $key = $e->spent_on->format('Y-m');
                if (isset($buckets[$key])) {
                    $buckets[$key] += (int) $e->amount_cents;
                }
            });

        return $buckets;
    }

    /** @return array<int, array{label: string, color: string, cents: int}> */
    private function expensesByCategory(Carbon $from, Carbon $to): array
    {
        return Expense::query()
            ->whereBetween('spent_on', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('category, sum(amount_cents) as cents')
            ->groupBy('category')
            ->orderByDesc('cents')
            ->get()
            ->values()
            ->map(fn ($r, $i) => [
                'label' => $r->category,
                'color' => self::PALETTE[$i % count(self::PALETTE)],
                'cents' => (int) $r->cents,
            ])
            ->all();
    }

    /** @return array<string, int|float> */
    private function pnl(int $revenue, int $expenses): array
    {
        $profit = $revenue - $expenses;

        return [
            'revenue_cents' => $revenue,
            'expenses_cents' => $expenses,
            'profit_cents' => $profit,
            'margin' => $revenue > 0 ? round($profit / $revenue * 100, 1) : 0.0,
        ];
    }

    /** @return array<int, array{label: string, color: string, cents: int}> */
    private function groupSum(Collection $events, string $field): array
    {
        $groups = [];
        foreach ($events as $e) {
            $label = $e[$field];
            $groups[$label] ??= ['label' => $label, 'color' => $e['type_color'], 'cents' => 0];
            $groups[$label]['cents'] += (int) $e['amount_cents'];
        }

        return collect($groups)->sortByDesc('cents')->values()->all();
    }

    private function revenueByType(Collection $events): array
    {
        $groups = [];
        foreach ($events as $e) {
            $label = $e['type_label'];
            $groups[$label] ??= ['label' => $label, 'color' => $e['type_color'], 'cents' => 0];
            $groups[$label]['cents'] += (int) $e['amount_cents'];
        }

        return collect($groups)->sortByDesc('cents')->values()->all();
    }

    /**
     * Point-in-time accounts receivable (as of today, independent of the range):
     * outstanding total, aging buckets, and the overdue invoice list.
     *
     * @return array{summary: array<string, mixed>, overdue: array<int, mixed>}
     */
    private function accountsReceivable(): array
    {
        $today = Carbon::today();
        $invoices = Invoice::query()
            ->where('status', '!=', 'void')
            ->with(['schedules', 'contact:id,first_name,last_name,company,email'])
            ->get();

        $aging = ['current' => 0, 'd1_30' => 0, 'd31_60' => 0, 'd61_90' => 0, 'd90_plus' => 0];
        $outstanding = 0;
        $overdueTotal = 0;
        $overdue = [];

        foreach ($invoices as $invoice) {
            $outstanding += $invoice->balanceCents();

            foreach ($invoice->reminderTargets() as $target) {
                $amount = (int) $target['amount_cents'];
                $due = $target['due_date'];

                if ($due->gte($today)) {
                    $aging['current'] += $amount;

                    continue;
                }

                $daysLate = $due->diffInDays($today);
                $overdueTotal += $amount;
                if ($daysLate <= 30) {
                    $aging['d1_30'] += $amount;
                } elseif ($daysLate <= 60) {
                    $aging['d31_60'] += $amount;
                } elseif ($daysLate <= 90) {
                    $aging['d61_90'] += $amount;
                } else {
                    $aging['d90_plus'] += $amount;
                }

                $overdue[] = [
                    'invoice_id' => $invoice->id,
                    'number' => $invoice->number,
                    'client' => $invoice->contact?->name ?? '—',
                    'due_date' => $due->toDateString(),
                    'days_late' => (int) $daysLate,
                    'amount_cents' => $amount,
                ];
            }
        }

        return [
            'summary' => [
                'outstanding_cents' => $outstanding,
                'overdue_cents' => $overdueTotal,
                'aging' => $aging,
            ],
            'overdue' => collect($overdue)->sortByDesc('days_late')->take(25)->values()->all(),
        ];
    }

    /** New leads in the window and how many converted into a project. */
    private function leadFunnel(Carbon $from, Carbon $to): array
    {
        $window = [$from->copy()->startOfDay(), $to->copy()->endOfDay()];

        $leads = SiteLead::query()->whereBetween('created_at', $window)->count();
        $converted = SiteLead::query()->whereBetween('created_at', $window)->whereNotNull('project_id')->count();
        $newProjects = Project::query()->whereBetween('created_at', $window)->count();

        $paidBookings = PackageBooking::query()->where('status', 'paid')->whereBetween('created_at', $window)->count();
        $meetings = Meeting::query()->whereIn('status', Meeting::ACTIVE_STATUSES)->whereBetween('created_at', $window)->count();

        return [
            'leads' => $leads,
            'converted' => $converted,
            'conversion_rate' => $leads > 0 ? round($converted / $leads * 100, 1) : 0.0,
            'new_projects' => $newProjects,
            'package_bookings' => $paidBookings,
            'meetings_booked' => $meetings,
        ];
    }

    /** @param  array{summary: array<string,mixed>}  $ar */
    private function kpis(Collection $events, array $ar, Carbon $from, Carbon $to): array
    {
        $collected = (int) $events->sum('amount_cents');
        $months = max(1, $from->copy()->startOfMonth()->diffInMonths($to->copy()->startOfMonth()) + 1);

        return [
            'collected_cents' => $collected,
            'avg_month_cents' => (int) round($collected / $months),
            'order_count' => $events->count(),
            'outstanding_cents' => $ar['summary']['outstanding_cents'],
            'overdue_cents' => $ar['summary']['overdue_cents'],
        ];
    }

    /**
     * Resolve the reporting window from the request, defaulting to the trailing
     * 12 months. Clamped so from ≤ to and the span ≤ MAX_MONTHS.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    private function range(Request $request): array
    {
        $to = $this->parseDate($request->input('to')) ?? Carbon::today();
        $from = $this->parseDate($request->input('from')) ?? $to->copy()->startOfMonth()->subMonths(11);

        if ($from->gt($to)) {
            [$from, $to] = [$to->copy(), $from->copy()];
        }
        if ($from->copy()->addMonths(self::MAX_MONTHS)->lt($to)) {
            $from = $to->copy()->subMonths(self::MAX_MONTHS);
        }

        return [$from->startOfDay(), $to->endOfDay()];
    }

    private function parseDate(?string $value): ?Carbon
    {
        if (! $value) {
            return null;
        }
        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    /** @return array<string, int> 'Y-m' => 0 for each month in [$from, $to]. */
    private function monthBuckets(Carbon $from, Carbon $to): array
    {
        $buckets = [];
        $cursor = $from->copy()->startOfMonth();
        $end = $to->copy()->startOfMonth();

        while ($cursor->lte($end)) {
            $buckets[$cursor->format('Y-m')] = 0;
            $cursor->addMonth();
        }

        return $buckets;
    }

    private function currency(): string
    {
        return Studio::find(app('current.studio.id'))?->default_currency ?? 'gbp';
    }
}
