<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\Studio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class InvoiceController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));
        $status = $request->input('status');

        $invoices = Invoice::query()
            ->with('contact:id,first_name,last_name,company,email')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('number', 'like', "%{$search}%")
                        ->orWhereHas('contact', function ($c) use ($search) {
                            $c->where('first_name', 'like', "%{$search}%")
                                ->orWhere('last_name', 'like', "%{$search}%")
                                ->orWhere('company', 'like', "%{$search}%");
                        });
                });
            })
            ->when(in_array($status, ['draft', 'sent', 'partial', 'paid', 'void'], true), fn ($q) => $q->where('status', $status))
            ->latest()
            ->paginate(30)
            ->withQueryString();

        return Inertia::render('Invoices/Index', [
            'invoices' => $invoices,
            'currency' => $this->studioCurrency(),
            'filters' => ['search' => $search, 'status' => $status],
            'summary' => [
                'outstanding_cents' => (int) Invoice::whereIn('status', ['sent', 'partial'])
                    ->sum(DB::raw('total_cents - amount_paid_cents')),
                'paid_cents' => (int) Invoice::where('status', 'paid')->sum('total_cents'),
                'draft_count' => Invoice::where('status', 'draft')->count(),
            ],
        ]);
    }

    public function create(): Response
    {
        $studio = Studio::findOrFail(app('current.studio.id'));
        $settings = $studio->invoiceSettings();

        return Inertia::render('Invoices/Create', [
            'projects' => $this->projectOptions(),
            'next_number' => $this->nextNumber(),
            'preselect_project_id' => request()->integer('project') ?: null,
            'default_currency' => $studio->default_currency ?? 'usd',
            'defaults' => [
                'payment_methods' => $settings['payment_methods'],
                'tax_rate' => $settings['default_tax_rate'],
                'notes' => $settings['payment_terms'] ?? '',
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateInvoice($request, creating: true);
        $currency = $this->studioCurrency();

        $invoice = DB::transaction(function () use ($data, $currency) {
            $invoice = Invoice::create([
                'project_id' => $data['project_id'],
                'contact_id' => $this->contactIdForProject($data['project_id']),
                'number' => $data['number'],
                'currency' => $currency,
                'issue_date' => $this->blankToNull($data['issue_date'] ?? null),
                'due_date' => $this->blankToNull($data['due_date'] ?? null),
                'event_date' => $this->blankToNull($data['event_date'] ?? null),
                'discount_cents' => $data['discount_cents'] ?? 0,
                'tax_rate' => $data['tax_rate'] ?? 0,
                'notes' => $data['notes'] ?? null,
                'payment_methods' => $data['payment_methods'] ?? null,
                'reminder_offsets' => $data['reminder_offsets'] ?? null,
                'status' => 'draft',
            ]);

            $this->syncItems($invoice, $data['items'] ?? []);
            $this->syncSchedules($invoice, $data['schedules'] ?? []);
            $invoice->load('items');
            $invoice->recalculateTotals();
            $invoice->save();

            return $invoice;
        });

        return redirect()->route('invoices.show', $invoice)->with('success', 'Invoice created.');
    }

    public function show(Invoice $invoice): Response
    {
        $invoice->load(['items', 'schedules', 'payments', 'contact:id,first_name,last_name,company,email,phone', 'project:id,name']);

        return Inertia::render('Invoices/Show', [
            'invoice' => $invoice,
        ]);
    }

    public function edit(Invoice $invoice): Response
    {
        $invoice->load(['items', 'schedules']);

        return Inertia::render('Invoices/Edit', [
            'invoice' => $invoice,
            'projects' => $this->projectOptions(),
        ]);
    }

    public function update(Request $request, Invoice $invoice): RedirectResponse
    {
        $data = $this->validateInvoice($request, creating: false, invoice: $invoice);

        DB::transaction(function () use ($invoice, $data) {
            $invoice->update([
                'project_id' => $data['project_id'],
                'contact_id' => $this->contactIdForProject($data['project_id']),
                'number' => $data['number'],
                'issue_date' => $this->blankToNull($data['issue_date'] ?? null),
                'due_date' => $this->blankToNull($data['due_date'] ?? null),
                'event_date' => $this->blankToNull($data['event_date'] ?? null),
                'discount_cents' => $data['discount_cents'] ?? 0,
                'tax_rate' => $data['tax_rate'] ?? 0,
                'notes' => $data['notes'] ?? null,
                'payment_methods' => $data['payment_methods'] ?? null,
                'reminder_offsets' => $data['reminder_offsets'] ?? null,
            ]);

            $this->syncItems($invoice, $data['items'] ?? []);
            $this->syncSchedules($invoice, $data['schedules'] ?? []);
            $invoice->load('items');
            $invoice->recalculateTotals();
            $invoice->save();
            // Totals may have shifted relative to payments → re-derive status.
            $invoice->syncPaymentState();
        });

        return redirect()->route('invoices.show', $invoice)->with('success', 'Invoice updated.');
    }

    public function destroy(Invoice $invoice): RedirectResponse
    {
        $invoice->delete();

        return redirect()->route('invoices.index')->with('success', 'Invoice deleted.');
    }

    public function markSent(Invoice $invoice): RedirectResponse
    {
        if ($invoice->status === 'draft') {
            $invoice->update(['status' => 'sent', 'sent_at' => now()]);
        }

        return back()->with('success', 'Invoice marked as sent.');
    }

    public function void(Invoice $invoice): RedirectResponse
    {
        $invoice->update(['status' => 'void']);

        return back()->with('success', 'Invoice voided.');
    }

    public function recordPayment(Request $request, Invoice $invoice): RedirectResponse
    {
        $validated = $request->validate([
            'amount_cents' => 'required|integer|min:1',
            'method' => ['nullable', Rule::in(['manual', 'stripe'])],
            'reference' => 'nullable|string|max:255',
            'paid_on' => 'nullable|date',
        ]);

        $invoice->payments()->create([
            'amount_cents' => $validated['amount_cents'],
            'method' => $validated['method'] ?? 'manual',
            'reference' => $validated['reference'] ?? null,
            'paid_on' => $validated['paid_on'] ?? now()->toDateString(),
        ]);

        $invoice->syncPaymentState();

        return back()->with('success', 'Payment recorded.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateInvoice(Request $request, bool $creating, ?Invoice $invoice = null): array
    {
        $numberRule = Rule::unique('invoices', 'number')
            ->where(fn ($q) => $q->where('studio_id', app('current.studio.id')));

        if (! $creating && $invoice) {
            $numberRule->ignore($invoice->id);
        }

        return $request->validate([
            // An invoice belongs to a project; the bill-to client is taken from it.
            'project_id' => 'required|integer|exists:projects,id',
            'number' => ['required', 'string', 'max:50', $numberRule],
            'issue_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'event_date' => 'nullable|date',
            'discount_cents' => 'nullable|integer|min:0',
            'tax_rate' => 'nullable|numeric|min:0|max:100',
            'notes' => 'nullable|string|max:5000',
            'payment_methods' => 'array',
            'payment_methods.*' => ['string', Rule::in(InvoiceSettingsController::METHODS)],
            'items' => 'array',
            'items.*.description' => 'required|string|max:500',
            'items.*.quantity' => 'required|numeric|min:0',
            'items.*.unit_amount_cents' => 'required|integer|min:0',
            'schedules' => 'array',
            'schedules.*.amount_cents' => 'required|integer|min:0',
            'schedules.*.due_date' => 'nullable|date',
            'reminder_offsets' => 'nullable|array',
            'reminder_offsets.*' => ['integer', Rule::in([-7, -3, 0, 3, 7])],
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function syncItems(Invoice $invoice, array $items): void
    {
        $invoice->items()->delete();

        foreach (array_values($items) as $position => $item) {
            $invoice->items()->create([
                'description' => $item['description'],
                'quantity' => $item['quantity'],
                'unit_amount_cents' => $item['unit_amount_cents'],
                'position' => $position,
            ]);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $schedules
     */
    private function syncSchedules(Invoice $invoice, array $schedules): void
    {
        $invoice->schedules()->delete();

        foreach (array_values($schedules) as $position => $schedule) {
            $invoice->schedules()->create([
                'amount_cents' => $schedule['amount_cents'],
                'due_date' => $this->blankToNull($schedule['due_date'] ?? null),
                'position' => $position,
            ]);
        }
    }

    /** Treat empty strings (e.g. unset date inputs) as null for nullable columns. */
    private function blankToNull(mixed $value): mixed
    {
        return ($value === '' || $value === null) ? null : $value;
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function projectOptions()
    {
        return Project::with('contact:id,first_name,last_name,company')
            ->orderByDesc('event_date')
            ->orderBy('name')
            ->get(['id', 'name', 'contact_id'])
            ->map(fn (Project $p) => [
                'id' => $p->id,
                'name' => $p->contact ? "{$p->name} — {$p->contact->name}" : $p->name,
            ]);
    }

    private function contactIdForProject(int $projectId): ?int
    {
        return Project::whereKey($projectId)->value('contact_id');
    }

    private function studioCurrency(): string
    {
        return Studio::find(app('current.studio.id'))?->default_currency ?? 'usd';
    }

    private function nextNumber(): string
    {
        // Highest existing INV-#### for this studio, +1. New studios start at INV-0001.
        $latest = Invoice::where('number', 'like', 'INV-%')
            ->orderByDesc('id')
            ->value('number');

        $n = $latest ? ((int) preg_replace('/\D/', '', $latest)) + 1 : 1;

        return 'INV-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
    }
}
