<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\ContractTemplate;
use App\Models\Invoice;
use App\Models\Project;
use App\Support\ClientEmailContent;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ContractController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));
        $status = $request->input('status');

        $contracts = Contract::query()
            ->with(['contact:id,first_name,last_name,company', 'project:id,name'])
            ->when($search !== '', fn ($q) => $q->where('title', 'like', "%{$search}%"))
            ->when(in_array($status, ['draft', 'sent', 'signed', 'declined', 'void'], true), fn ($q) => $q->where('status', $status))
            ->latest()
            ->paginate(30)
            ->withQueryString()
            ->through(fn (Contract $c) => [
                'id' => $c->id,
                'title' => $c->title,
                'status' => $c->status,
                'project' => $c->project ? ['id' => $c->project->id, 'name' => $c->project->name] : null,
                'contact' => $c->contact ? ['name' => $c->contact->name] : null,
                'updated_at' => $c->updated_at->toDateString(),
            ]);

        return Inertia::render('Contracts/Index', [
            'contracts' => $contracts,
            'filters' => ['search' => $search, 'status' => $status],
        ]);
    }

    public function create(): Response
    {
        if (ContractTemplate::count() === 0) {
            ContractTemplate::seedDefaults();
        }

        return Inertia::render('Contracts/Create', [
            'projects' => $this->projectOptions(),
            'invoices' => $this->invoiceOptions(),
            'templates' => ContractTemplate::orderBy('name')->get(['id', 'name', 'body', 'fields']),
            'preselect_project_id' => request()->integer('project') ?: null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateContract($request);

        $contract = Contract::create([
            'project_id' => $data['project_id'],
            'contact_id' => $this->contactIdForProject($data['project_id']),
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'fields' => $data['fields'] ?? [],
            'status' => 'draft',
        ]);

        return redirect()->route('contracts.show', $contract)->with('success', 'Contract created.');
    }

    public function show(Contract $contract): Response
    {
        $contract->load(['signatures', 'contact:id,first_name,last_name,company,email', 'project:id,name,contact_id', 'project.contact:id,first_name,last_name,company,email', 'studio']);

        return Inertia::render('Contracts/Show', [
            'contract' => $contract,
            'sign_url' => route('contracts.public.show', $contract->public_id),
            'invoice_html' => $contract->invoiceBlocks(),
            'email_defaults' => ClientEmailContent::defaults($contract),
        ]);
    }

    public function edit(Contract $contract): Response
    {
        return Inertia::render('Contracts/Edit', [
            'contract' => $contract,
            'projects' => $this->projectOptions(),
            'invoices' => $this->invoiceOptions(),
        ]);
    }

    public function update(Request $request, Contract $contract): RedirectResponse
    {
        $data = $this->validateContract($request);

        $contract->update([
            'project_id' => $data['project_id'],
            'contact_id' => $this->contactIdForProject($data['project_id']),
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'fields' => $data['fields'] ?? [],
        ]);

        return redirect()->route('contracts.show', $contract)->with('success', 'Contract updated.');
    }

    public function destroy(Contract $contract): RedirectResponse
    {
        $contract->delete();

        return redirect()->route('contracts.index')->with('success', 'Contract deleted.');
    }

    public function send(Contract $contract): RedirectResponse
    {
        abort_unless(in_array($contract->status, ['draft', 'sent'], true), 422);

        $contract->update([
            'status' => 'sent',
            'sent_at' => $contract->sent_at ?? now(),
        ]);

        return back()->with('success', 'Contract is ready to sign. Share the signing link with your client.');
    }

    public function sign(Request $request, Contract $contract): RedirectResponse
    {
        abort_if(in_array($contract->status, ['void', 'declined'], true), 422);

        $data = $request->validate([
            'signer_name' => 'required|string|max:255',
            'signature_type' => ['required', Rule::in(['typed', 'drawn'])],
            'signature_data' => 'required|string',
        ]);

        $contract->signatures()->updateOrCreate(
            ['role' => 'studio'],
            [
                'studio_id' => $contract->studio_id,
                'signer_name' => $data['signer_name'],
                'signature_type' => $data['signature_type'],
                'signature_data' => $data['signature_data'],
                'signed_at' => now(),
                'ip_address' => $request->ip(),
            ],
        );

        $contract->load('signatures');
        if ($contract->signatureFor('studio') && $contract->signatureFor('client')) {
            $contract->update(['status' => 'signed', 'signed_at' => now()]);
        }

        return back()->with('success', 'You have signed the contract.');
    }

    public function void(Contract $contract): RedirectResponse
    {
        $contract->update(['status' => 'void']);

        return back()->with('success', 'Contract voided.');
    }

    public function pdf(Contract $contract): \Symfony\Component\HttpFoundation\Response|RedirectResponse
    {
        $contract->load(['signatures', 'studio']);

        try {
            $pdf = Pdf::loadView('contracts.pdf', [
                'contract' => $contract,
                'body' => $contract->renderedBody(),
                'studio' => $contract->studio,
            ]);

            return $pdf->download(Str::slug($contract->title ?: 'contract').'.pdf');
        } catch (\Throwable $e) {
            report($e);

            return back()->with('error', 'Sorry, the PDF could not be generated right now. Please try again.');
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function validateContract(Request $request): array
    {
        return $request->validate([
            'project_id' => 'required|integer|exists:projects,id',
            'title' => 'required|string|max:255',
            'body' => 'nullable|string',
            'fields' => 'array',
            'fields.*.key' => 'required|string|max:60',
            'fields.*.label' => 'required|string|max:255',
            'fields.*.type' => ['required', Rule::in(['text', 'multiline', 'date', 'checkbox', 'invoice'])],
            'fields.*.fill_by' => ['required', Rule::in(['studio', 'client'])],
            'fields.*.value' => 'nullable',
        ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function projectOptions()
    {
        return Project::with('contact:id,first_name,last_name,company,email')
            ->orderByDesc('event_date')
            ->orderBy('name')
            ->get(['id', 'name', 'contact_id', 'event_date'])
            ->map(fn (Project $p) => [
                'id' => $p->id,
                'name' => $p->contact ? "{$p->name} — {$p->contact->name}" : $p->name,
                'email' => $p->contact?->email,
                'event_date' => $p->event_date?->toDateString(),
            ]);
    }

    private function contactIdForProject(int $projectId): ?int
    {
        return Project::whereKey($projectId)->value('contact_id');
    }

    /**
     * Invoices available to link from an invoice-type field.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function invoiceOptions()
    {
        return Invoice::query()
            ->latest('id')
            ->get(['id', 'number', 'project_id', 'total_cents', 'currency'])
            ->map(fn (Invoice $i) => [
                'id' => $i->id,
                'number' => $i->number,
                'project_id' => $i->project_id,
                'total_cents' => $i->total_cents,
                'currency' => $i->currency,
            ]);
    }
}
