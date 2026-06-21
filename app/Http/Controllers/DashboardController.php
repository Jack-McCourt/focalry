<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Studio;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /** How far back / forward the charts look. */
    private const PAST_MONTHS = 12;

    private const FUTURE_MONTHS = 24;

    public function __invoke(): Response
    {
        $today = Carbon::today();
        $currency = $this->currency();

        // Every non-void invoice for this studio, with what we need to do the math.
        $invoices = Invoice::query()
            ->where('status', '!=', 'void')
            ->with(['schedules', 'contact:id,first_name,last_name,company,email', 'project.type:id,label,color'])
            ->get();

        // Every payment in the trailing window, for the earnings chart + breakdowns.
        $windowStart = $today->copy()->startOfMonth()->subMonths(self::PAST_MONTHS - 1);
        $payments = InvoicePayment::query()
            ->whereHas('invoice', fn ($q) => $q->where('status', '!=', 'void'))
            ->where('paid_on', '>=', $windowStart)
            ->with(['invoice.contact:id,first_name,last_name,company,email', 'invoice.project.type:id,label,color'])
            ->get();

        return Inertia::render('Dashboard', [
            'currency' => $currency,
            'earnings' => $this->earningsSeries($payments, $today),
            'projected' => $this->projectedSeries($invoices, $today),
            'revenueByType' => $this->revenueByType($payments),
            'statusBreakdown' => $this->statusBreakdown($invoices, $today),
            'topClients' => $this->topClients($payments),
            'upcomingPayments' => $this->upcomingPayments($invoices, $today),
            'kpis' => $this->kpis($invoices, $payments, $today),
        ]);
    }

    /** Collected revenue per calendar month over the trailing 12 months. */
    private function earningsSeries(Collection $payments, Carbon $today): array
    {
        $buckets = $this->emptyMonthBuckets($today->copy()->startOfMonth()->subMonths(self::PAST_MONTHS - 1), self::PAST_MONTHS);

        foreach ($payments as $payment) {
            $key = Carbon::parse($payment->paid_on)->format('Y-m');
            if (isset($buckets[$key])) {
                $buckets[$key] += (int) $payment->amount_cents;
            }
        }

        return $this->shapeSeries($buckets, 'earned_cents');
    }

    /**
     * Outstanding instalments due in each of the next 24 months.
     * Uses Invoice::reminderTargets() so partial payments are allocated correctly.
     */
    private function projectedSeries(Collection $invoices, Carbon $today): array
    {
        // +1 so an instalment due exactly FUTURE_MONTHS out still lands in a bucket.
        $buckets = $this->emptyMonthBuckets($today->copy()->startOfMonth(), self::FUTURE_MONTHS + 1);

        foreach ($invoices as $invoice) {
            foreach ($invoice->reminderTargets() as $target) {
                if ($target['due_date']->lt($today)) {
                    continue; // overdue — surfaced separately, not "projected"
                }
                $key = $target['due_date']->format('Y-m');
                if (isset($buckets[$key])) {
                    $buckets[$key] += (int) $target['amount_cents'];
                }
            }
        }

        return $this->shapeSeries($buckets, 'projected_cents');
    }

    /** Collected revenue grouped by project type, last 12 months. */
    private function revenueByType(Collection $payments): array
    {
        $groups = [];

        foreach ($payments as $payment) {
            $type = $payment->invoice?->project?->type;
            $label = $type?->label ?? 'Uncategorised';
            $color = $type?->color ?? '#9ca3af';

            $groups[$label] ??= ['label' => $label, 'color' => $color, 'cents' => 0];
            $groups[$label]['cents'] += (int) $payment->amount_cents;
        }

        return collect($groups)->sortByDesc('cents')->values()->all();
    }

    /** Invoice counts by working state (overdue is derived, not stored). */
    private function statusBreakdown(Collection $invoices, Carbon $today): array
    {
        $counts = ['paid' => 0, 'partial' => 0, 'sent' => 0, 'overdue' => 0, 'draft' => 0];

        foreach ($invoices as $invoice) {
            $isOverdue = $invoice->balanceCents() > 0
                && $invoice->due_date
                && $invoice->due_date->lt($today)
                && in_array($invoice->status, ['sent', 'partial'], true);

            if ($isOverdue) {
                $counts['overdue']++;
            } elseif (isset($counts[$invoice->status])) {
                $counts[$invoice->status]++;
            }
        }

        return $counts;
    }

    /** Highest-paying clients over the trailing 12 months. */
    private function topClients(Collection $payments): array
    {
        $groups = [];

        foreach ($payments as $payment) {
            $contact = $payment->invoice?->contact;
            if (! $contact) {
                continue;
            }
            $groups[$contact->id] ??= ['name' => $contact->name, 'cents' => 0];
            $groups[$contact->id]['cents'] += (int) $payment->amount_cents;
        }

        return collect($groups)->sortByDesc('cents')->take(6)->values()->all();
    }

    /** The next outstanding instalments due, soonest first. */
    private function upcomingPayments(Collection $invoices, Carbon $today): array
    {
        $rows = [];

        foreach ($invoices as $invoice) {
            foreach ($invoice->reminderTargets() as $target) {
                if ($target['due_date']->lt($today)) {
                    continue;
                }
                $rows[] = [
                    'invoice_id' => $invoice->id,
                    'number' => $invoice->number,
                    'client' => $invoice->contact?->name ?? '—',
                    'due_date' => $target['due_date']->toDateString(),
                    'amount_cents' => (int) $target['amount_cents'],
                ];
            }
        }

        return collect($rows)->sortBy('due_date')->take(8)->values()->all();
    }

    private function kpis(Collection $invoices, Collection $payments, Carbon $today): array
    {
        $thisMonthKey = $today->format('Y-m');
        $last12 = (int) $payments->sum('amount_cents');
        $thisMonthEarned = (int) $payments
            ->filter(fn ($p) => Carbon::parse($p->paid_on)->format('Y-m') === $thisMonthKey)
            ->sum('amount_cents');

        $projectedNext12 = 0;
        $projectedTotal = 0;
        $overdueCents = 0;
        $overdueCount = 0;
        $outstandingCents = 0;
        $next30 = 0;
        $in30Days = $today->copy()->addDays(30);

        foreach ($invoices as $invoice) {
            $outstandingCents += $invoice->balanceCents();

            foreach ($invoice->reminderTargets() as $target) {
                $amount = (int) $target['amount_cents'];

                if ($target['due_date']->lt($today)) {
                    $overdueCents += $amount;
                    $overdueCount++;

                    continue;
                }

                $projectedTotal += $amount;
                if ($target['due_date']->lte($today->copy()->addMonths(12))) {
                    $projectedNext12 += $amount;
                }
                if ($target['due_date']->lte($in30Days)) {
                    $next30 += $amount;
                }
            }
        }

        return [
            'earned_last_12_cents' => $last12,
            'earned_this_month_cents' => $thisMonthEarned,
            'avg_month_cents' => (int) round($last12 / self::PAST_MONTHS),
            'projected_total_cents' => $projectedTotal,
            'projected_next_12_cents' => $projectedNext12,
            'due_next_30_cents' => $next30,
            'overdue_cents' => $overdueCents,
            'overdue_count' => $overdueCount,
            'outstanding_cents' => $outstandingCents,
        ];
    }

    /** @return array<string, int> map of 'Y-m' => 0 for $count months from $start. */
    private function emptyMonthBuckets(Carbon $start, int $count): array
    {
        $buckets = [];
        $cursor = $start->copy();

        for ($i = 0; $i < $count; $i++) {
            $buckets[$cursor->format('Y-m')] = 0;
            $cursor->addMonth();
        }

        return $buckets;
    }

    /**
     * Turn a 'Y-m' => cents map into a labelled series for the chart.
     *
     * @param  array<string, int>  $buckets
     */
    private function shapeSeries(array $buckets, string $valueKey): array
    {
        return collect($buckets)->map(function (int $cents, string $key) use ($valueKey) {
            $date = Carbon::createFromFormat('Y-m', $key)->startOfMonth();

            return [
                'key' => $key,
                'label' => $date->format('M'),
                // Show the year on January (and the very first point reads clearly).
                'year' => $date->format('Y'),
                'show_year' => $date->month === 1,
                $valueKey => $cents,
            ];
        })->values()->all();
    }

    private function currency(): string
    {
        return Studio::find(app('current.studio.id'))?->default_currency ?? 'gbp';
    }
}
