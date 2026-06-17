<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Studio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class InvoiceSettingsController extends Controller
{
    public const METHODS = ['card', 'bank_transfer'];

    public function edit(): Response
    {
        $studio = Studio::findOrFail(app('current.studio.id'));

        return Inertia::render('Invoices/Settings', [
            'settings' => $studio->invoiceSettings(),
            'stripe_connected' => $studio->stripe_connect_status === 'active',
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $studio = Studio::findOrFail(app('current.studio.id'));

        $validated = $request->validate([
            'payment_methods' => 'array',
            'payment_methods.*' => ['string', Rule::in(self::METHODS)],
            'bank_details' => 'nullable|string|max:2000',
            'payment_terms' => 'nullable|string|max:2000',
            'default_tax_rate' => 'nullable|numeric|min:0|max:100',
        ]);

        $studio->update([
            'invoice_settings' => [
                'payment_methods' => array_values($validated['payment_methods'] ?? []),
                'bank_details' => $validated['bank_details'] ?? null,
                'payment_terms' => $validated['payment_terms'] ?? null,
                'default_tax_rate' => (float) ($validated['default_tax_rate'] ?? 0),
            ],
        ]);

        return back()->with('success', 'Invoice settings saved.');
    }
}
