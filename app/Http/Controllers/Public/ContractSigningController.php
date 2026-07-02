<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Services\WorkflowEngine;
use App\Support\StudioNotifications;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ContractSigningController extends Controller
{
    public function show(string $publicId): Response
    {
        $contract = $this->resolve($publicId);
        $studio = $contract->studio;

        $clientSig = $contract->signatureFor('client');
        $studioSig = $contract->signatureFor('studio');

        return Inertia::render('Contracts/Sign', [
            'contract' => [
                'public_id' => $contract->public_id,
                'title' => $contract->title,
                'status' => $contract->status,
                'body' => $contract->renderedBody(),
                'client_fields' => collect($contract->fields ?? [])
                    ->where('fill_by', 'client')
                    ->map(fn ($f) => [
                        'key' => $f['key'],
                        'label' => $f['label'],
                        'type' => $f['type'],
                        'value' => $f['value'] ?? null,
                    ])
                    ->values(),
                'signed' => (bool) $clientSig,
                'signed_at' => $contract->signed_at?->toDateString(),
            ],
            'studio_name' => $studio?->name,
            'studio_logo' => $studio?->logoUrl(),
            'studio_signature' => $studioSig ? [
                'signer_name' => $studioSig->signer_name,
                'signature_type' => $studioSig->signature_type,
                'signature_data' => $studioSig->signature_data,
                'signed_at' => $studioSig->signed_at?->toDateString(),
            ] : null,
            'client_signature' => $clientSig ? [
                'signer_name' => $clientSig->signer_name,
                'signature_type' => $clientSig->signature_type,
                'signature_data' => $clientSig->signature_data,
                'signed_at' => $clientSig->signed_at?->toDateString(),
            ] : null,
        ]);
    }

    public function sign(Request $request, string $publicId, WorkflowEngine $engine): RedirectResponse
    {
        $contract = $this->resolve($publicId);

        abort_unless($contract->status === 'sent', 422, 'This contract is not available for signing.');
        abort_if((bool) $contract->signatureFor('client'), 422, 'This contract has already been signed.');

        $fields = collect($contract->fields ?? []);
        $clientKeys = $fields->where('fill_by', 'client')->pluck('key')->all();

        $rules = [
            'signer_name' => 'required|string|max:255',
            'signature_type' => ['required', Rule::in(['typed', 'drawn'])],
            'signature_data' => 'required|string',
            'values' => 'array',
        ];
        foreach ($fields->where('fill_by', 'client') as $f) {
            $rules["values.{$f['key']}"] = $f['type'] === 'checkbox' ? 'nullable|boolean' : 'nullable|string|max:2000';
        }

        $data = $request->validate($rules);

        // Merge submitted client values back into the stored fields json.
        $submitted = $data['values'] ?? [];
        $updatedFields = $fields->map(function ($f) use ($clientKeys, $submitted) {
            if (in_array($f['key'], $clientKeys, true) && array_key_exists($f['key'], $submitted)) {
                $f['value'] = $submitted[$f['key']];
            }

            return $f;
        })->values()->all();

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

        $contract->fields = $updatedFields;

        // Fully executed once both parties have signed.
        $contract->load('signatures');
        $becameSigned = false;
        if ($contract->signatureFor('studio')) {
            $contract->status = 'signed';
            $contract->signed_at = now();
            $becameSigned = true;
        }
        $contract->save();

        // Fire any "contract signed" automations for the linked project.
        if ($becameSigned && $contract->project) {
            $engine->dispatch('contract_signed', $contract->project);
        }

        $signerName = $contract->signatureFor('client')?->signer_name ?? 'A client';
        StudioNotifications::send(
            $contract->studio_id,
            'contract_signed',
            'Contract signed',
            "{$signerName} signed \"{$contract->title}\".",
            route('contracts.show', $contract->id),
        );

        return redirect()
            ->route('contracts.public.show', $contract->public_id)
            ->with('success', 'Thank you — your signature has been recorded.');
    }

    private function resolve(string $publicId): Contract
    {
        return Contract::withoutGlobalScopes()
            ->with(['signatures', 'studio', 'contact', 'project'])
            ->where('public_id', $publicId)
            ->firstOrFail();
    }
}
