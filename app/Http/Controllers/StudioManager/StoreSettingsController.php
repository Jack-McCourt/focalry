<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\ShippingMethod;
use App\Models\TaxRate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StoreSettingsController extends Controller
{
    public function edit(Request $request): Response
    {
        $studio = $request->user()->studio;

        return Inertia::render('Store/Settings', [
            'settings' => $studio->storeSettings(),
            'tax_rates' => TaxRate::orderByDesc('is_default')->orderBy('name')
                ->get(['id', 'name', 'rate_bps', 'region', 'is_default', 'active']),
            'shipping_methods' => ShippingMethod::orderBy('position')
                ->get(['id', 'name', 'price_cents', 'is_pickup', 'active', 'description']),
            'default_currency' => $studio->default_currency ?? 'gbp',
            'stripe_ready' => $studio->stripe_connect_status === 'active',
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'hold_for_review' => 'boolean',
            'review_window_hours' => 'integer|min:0|max:336',
        ]);

        $studio = $request->user()->studio;
        $studio->update(['store_settings' => array_merge($studio->store_settings ?? [], $data)]);

        return back()->with('success', 'Store settings saved.');
    }

    // ── Tax rates ──────────────────────────────────────────────────────────

    public function storeTax(Request $request): RedirectResponse
    {
        TaxRate::create($this->validatedTax($request));

        return back()->with('success', 'Tax rate added.');
    }

    public function updateTax(Request $request, TaxRate $taxRate): RedirectResponse
    {
        $taxRate->update($this->validatedTax($request));

        return back()->with('success', 'Tax rate updated.');
    }

    public function destroyTax(TaxRate $taxRate): RedirectResponse
    {
        $taxRate->delete();

        return back()->with('success', 'Tax rate deleted.');
    }

    // ── Shipping methods ─────────────────────────────────────────────────────

    public function storeShipping(Request $request): RedirectResponse
    {
        $data = $this->validatedShipping($request);
        $data['position'] = (int) ShippingMethod::max('position') + 1;
        ShippingMethod::create($data);

        return back()->with('success', 'Shipping method added.');
    }

    public function updateShipping(Request $request, ShippingMethod $shippingMethod): RedirectResponse
    {
        $shippingMethod->update($this->validatedShipping($request));

        return back()->with('success', 'Shipping method updated.');
    }

    public function destroyShipping(ShippingMethod $shippingMethod): RedirectResponse
    {
        $shippingMethod->delete();

        return back()->with('success', 'Shipping method deleted.');
    }

    /** @return array<string, mixed> */
    private function validatedTax(Request $request): array
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'rate_bps' => 'required|integer|min:0|max:100000',
            'region' => 'nullable|string|max:255',
            'is_default' => 'boolean',
            'active' => 'boolean',
        ]);

        if ($data['is_default'] ?? false) {
            TaxRate::where('is_default', true)->update(['is_default' => false]);
        }

        return $data;
    }

    /** @return array<string, mixed> */
    private function validatedShipping(Request $request): array
    {
        return $request->validate([
            'name' => 'required|string|max:255',
            'price_cents' => 'required|integer|min:0',
            'is_pickup' => 'boolean',
            'active' => 'boolean',
            'description' => 'nullable|string|max:500',
        ]);
    }
}
