<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Services\WorkflowEngine;
use App\Support\Money;
use App\Support\StudioNotifications;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PublicProposalController extends Controller
{
    public function show(string $publicId): Response
    {
        $proposal = $this->resolve($publicId);

        // Re-evaluate acceptance in case the deposit was paid via Stripe webhook.
        $this->refreshAcceptance($proposal);

        $studio = $proposal->studio;
        $contract = $proposal->contract;
        $invoice = $proposal->invoice;
        $package = $proposal->package;

        return Inertia::render('Public/Proposal/View', [
            'proposal' => [
                'public_id' => $proposal->public_id,
                'title' => $proposal->title,
                'intro' => $proposal->intro,
                'status' => $proposal->status,
                'require_signature' => $proposal->require_signature,
                'require_deposit' => $proposal->require_deposit,
                'accepted_at' => $proposal->accepted_at?->toDateString(),
            ],
            'package' => $package ? [
                'name' => $package->name,
                'description' => $package->description,
                'details' => $package->details,
                'price' => Money::format((int) $package->price_cents, $package->currency),
            ] : null,
            'contract' => $contract ? [
                'title' => $contract->title,
                'body' => $contract->renderedBody(),
                'signed' => (bool) $contract->signatureFor('client'),
            ] : null,
            'invoice' => $invoice ? [
                'number' => $invoice->number,
                'total' => Money::format((int) $invoice->total_cents, $invoice->currency),
                'payable' => Money::format($invoice->payableCents(), $invoice->currency),
                'paid' => (int) $invoice->amount_paid_cents > 0,
                'pay_url' => route('invoices.public.show', $invoice->public_id),
            ] : null,
            'studio_name' => $studio?->name,
            'studio_logo' => $studio?->logoUrl(),
        ]);
    }

    public function sign(Request $request, string $publicId, WorkflowEngine $engine): RedirectResponse
    {
        $proposal = $this->resolve($publicId);
        $contract = $proposal->contract;

        abort_unless($proposal->require_signature && $contract, 422, 'This proposal does not require a signature.');
        abort_if((bool) $contract->signatureFor('client'), 422, 'This proposal has already been signed.');

        $data = $request->validate([
            'signer_name' => 'required|string|max:255',
            'signature_type' => ['required', Rule::in(['typed', 'drawn'])],
            'signature_data' => 'required|string',
        ]);

        $contract->signatures()->updateOrCreate(
            ['role' => 'client'],
            [
                'studio_id' => $contract->studio_id,
                'signer_name' => $data['signer_name'],
                'signature_type' => $data['signature_type'],
                'signature_data' => $data['signature_data'],
                'signed_at' => now(),
                'ip_address' => $request->ip(),
            ],
        );

        // The proposal itself is the studio's offer, so a client signature
        // executes the bundled contract.
        $contract->update(['status' => 'signed', 'signed_at' => now()]);

        // Fire any "contract signed" automations.
        if ($proposal->project) {
            $engine->dispatch('contract_signed', $proposal->project);
        }

        $this->refreshAcceptance($proposal);

        StudioNotifications::send(
            $proposal->studio_id,
            'proposal_accepted',
            'Proposal accepted',
            "{$data['signer_name']} accepted \"{$proposal->title}\".",
            route('proposals.show', $proposal->id),
        );

        return redirect()
            ->route('proposals.public.show', $proposal->public_id)
            ->with('success', 'Thank you — your signature has been recorded.');
    }

    /** Flip the proposal to accepted (and fire automations) once all steps are done. */
    private function refreshAcceptance(Proposal $proposal): void
    {
        if ($proposal->status === 'accepted') {
            return;
        }

        $proposal->loadMissing(['contract', 'invoice', 'project']);

        if ($proposal->status === 'sent' && $proposal->isFullyAccepted()) {
            $proposal->update(['status' => 'accepted', 'accepted_at' => now()]);

            if ($proposal->project) {
                app(WorkflowEngine::class)->dispatch('proposal_accepted', $proposal->project);
            }
        }
    }

    private function resolve(string $publicId): Proposal
    {
        return Proposal::withoutGlobalScopes()
            ->with(['studio', 'project', 'package', 'contract.signatures', 'invoice'])
            ->where('public_id', $publicId)
            ->firstOrFail();
    }
}
