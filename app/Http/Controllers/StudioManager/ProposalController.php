<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Mail\ClientMessage;
use App\Models\ClientEmail;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Package;
use App\Models\Project;
use App\Models\Proposal;
use App\Support\ClientEmailContent;
use App\Support\Money;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;
use Inertia\Response;

class ProposalController extends Controller
{
    public function index(Request $request): Response
    {
        $status = $request->input('status');

        $proposals = Proposal::query()
            ->with(['project:id,name', 'contact:id,first_name,last_name,company'])
            ->when(in_array($status, ['draft', 'sent', 'accepted', 'declined'], true), fn ($q) => $q->where('status', $status))
            ->latest()
            ->get()
            ->map(fn (Proposal $p) => [
                'id' => $p->id,
                'title' => $p->title,
                'status' => $p->status,
                'project' => $p->project ? ['id' => $p->project->id, 'name' => $p->project->name] : null,
                'contact' => $p->contact ? ['name' => $p->contact->name] : null,
                'updated_at' => $p->updated_at->toDateString(),
            ]);

        return Inertia::render('Proposals/Index', [
            'proposals' => $proposals,
            'filters' => ['status' => $status],
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('Proposals/Create', [
            'projects' => $this->projectOptions(),
            'packages' => Package::orderBy('sort_order')->get(['id', 'name', 'price_cents', 'deposit_cents', 'currency']),
            'contracts' => Contract::latest('id')->get(['id', 'title', 'project_id', 'status']),
            'invoices' => Invoice::latest('id')->get(['id', 'number', 'project_id', 'total_cents', 'currency', 'status'])
                ->map(fn (Invoice $i) => [
                    'id' => $i->id,
                    'label' => "{$i->number} · ".Money::format((int) $i->total_cents, $i->currency),
                    'project_id' => $i->project_id,
                ]),
            'preselect_project_id' => $request->integer('project') ?: null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateProposal($request);

        $proposal = Proposal::create([
            'project_id' => $data['project_id'],
            'contact_id' => Project::whereKey($data['project_id'])->value('contact_id'),
            'title' => $data['title'],
            'intro' => $data['intro'] ?? null,
            'package_id' => $data['package_id'] ?? null,
            'contract_id' => $data['contract_id'] ?? null,
            'invoice_id' => $data['invoice_id'] ?? null,
            'require_signature' => $data['require_signature'] ?? true,
            'require_deposit' => $data['require_deposit'] ?? true,
            'status' => 'draft',
        ]);

        return redirect()->route('proposals.show', $proposal)->with('success', 'Proposal created.');
    }

    public function show(Proposal $proposal): Response
    {
        $proposal->load([
            'project:id,name',
            'contact:id,first_name,last_name,company,email',
            'package:id,name,price_cents,deposit_cents,currency',
            'contract:id,title,status',
            'invoice:id,number,status,total_cents,amount_paid_cents,currency',
        ]);

        return Inertia::render('Proposals/Show', [
            'proposal' => [
                'id' => $proposal->id,
                'title' => $proposal->title,
                'status' => $proposal->status,
                'intro' => $proposal->intro,
                'require_signature' => $proposal->require_signature,
                'require_deposit' => $proposal->require_deposit,
                'project' => $proposal->project ? ['id' => $proposal->project->id, 'name' => $proposal->project->name] : null,
                'contact' => $proposal->contact ? ['name' => $proposal->contact->name, 'email' => $proposal->contact->email] : null,
                'package' => $proposal->package ? [
                    'name' => $proposal->package->name,
                    'price' => Money::format((int) $proposal->package->price_cents, $proposal->package->currency),
                ] : null,
                'contract' => $proposal->contract ? ['id' => $proposal->contract->id, 'title' => $proposal->contract->title, 'status' => $proposal->contract->status] : null,
                'invoice' => $proposal->invoice ? [
                    'id' => $proposal->invoice->id,
                    'number' => $proposal->invoice->number,
                    'status' => $proposal->invoice->status,
                    'total' => Money::format((int) $proposal->invoice->total_cents, $proposal->invoice->currency),
                    'paid' => Money::format((int) $proposal->invoice->amount_paid_cents, $proposal->invoice->currency),
                ] : null,
                'accepted_at' => $proposal->accepted_at?->toDateString(),
            ],
            'public_url' => route('proposals.public.show', $proposal->public_id),
        ]);
    }

    public function send(Request $request, Proposal $proposal): RedirectResponse
    {
        if (in_array($proposal->status, ['accepted', 'declined'], true)) {
            return back()->with('error', 'This proposal has already been '.$proposal->status.'.');
        }

        $proposal->loadMissing(['contact', 'studio', 'project.contact']);

        $to = ClientEmailContent::recipientEmail($proposal);
        if (! $to) {
            return back()->with('error', 'Add an email address to this client before sending the proposal.');
        }

        // Move the bundled contract / invoice into a sendable state too.
        if ($proposal->contract && $proposal->contract->status === 'draft') {
            $proposal->contract->update(['status' => 'sent', 'sent_at' => now()]);
        }
        if ($proposal->invoice && $proposal->invoice->status === 'draft') {
            $proposal->invoice->update(['status' => 'sent', 'sent_at' => now()]);
        }

        $studioName = $proposal->studio?->name ?: config('app.name');
        $log = new ClientEmail([
            'studio_id' => $proposal->studio_id,
            'contact_id' => ClientEmailContent::contactId($proposal),
            'emailable_type' => $proposal::class,
            'emailable_id' => $proposal->getKey(),
            'sent_by' => $request->user()?->id,
            'to_email' => $to,
            'subject' => ClientEmailContent::subject($proposal),
            'body' => ClientEmailContent::body($proposal),
            'details' => [],
        ]);

        try {
            Mail::to($to)->send(new ClientMessage(
                studioName: $studioName,
                subjectLine: ClientEmailContent::subject($proposal),
                bodyText: ClientEmailContent::body($proposal),
                ctaLabel: ClientEmailContent::ctaLabel($proposal),
                ctaUrl: ClientEmailContent::ctaUrl($proposal),
                details: [],
                replyToEmail: $request->user()?->email,
            ));
        } catch (\Throwable $e) {
            report($e);
            $log->fill(['status' => 'failed', 'error' => $e->getMessage()])->save();

            return back()->with('error', 'The proposal could not be emailed: '.$e->getMessage());
        }

        $log->fill(['status' => 'sent', 'sent_at' => now()])->save();
        $proposal->update(['status' => 'sent', 'sent_at' => $proposal->sent_at ?? now()]);

        return back()->with('success', 'Proposal emailed to '.$to.'.');
    }

    public function destroy(Proposal $proposal): RedirectResponse
    {
        $proposal->delete();

        return redirect()->route('proposals.index')->with('success', 'Proposal deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateProposal(Request $request): array
    {
        return $request->validate([
            'project_id' => 'required|integer|exists:projects,id',
            'title' => 'required|string|max:255',
            'intro' => 'nullable|string|max:5000',
            'package_id' => 'nullable|integer|exists:packages,id',
            'contract_id' => 'nullable|integer|exists:contracts,id',
            'invoice_id' => 'nullable|integer|exists:invoices,id',
            'require_signature' => 'boolean',
            'require_deposit' => 'boolean',
        ]);
    }

    private function projectOptions()
    {
        return Project::with('contact:id,first_name,last_name,company')
            ->orderByDesc('event_date')->orderBy('name')
            ->get(['id', 'name', 'contact_id'])
            ->map(fn (Project $p) => [
                'id' => $p->id,
                'name' => $p->contact ? "{$p->name} — {$p->contact->name}" : $p->name,
            ]);
    }
}
