<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Support\Currencies;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CouponController extends Controller
{
    public function index(Request $request): Response
    {
        $studio = $request->user()->studio;

        return Inertia::render('Store/Coupons', [
            'coupons' => Coupon::latest()->get()->map(fn (Coupon $c) => [
                ...$c->only([
                    'id', 'code', 'type', 'value', 'currency', 'min_subtotal_cents',
                    'max_redemptions', 'redeemed_count', 'active', 'show_banner', 'banner_text',
                ]),
                'starts_at' => $c->starts_at?->toDateString(),
                'expires_at' => $c->expires_at?->toDateString(),
            ]),
            'default_currency' => $studio?->default_currency ?? 'gbp',
            'currencies' => collect(Currencies::CURRENCIES)->map(fn ($label, $code) => ['code' => $code, 'label' => $label])->values(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Coupon::create($this->validated($request));

        return back()->with('success', 'Coupon created.');
    }

    public function update(Request $request, Coupon $coupon): RedirectResponse
    {
        $coupon->update($this->validated($request, $coupon));

        return back()->with('success', 'Coupon updated.');
    }

    public function destroy(Coupon $coupon): RedirectResponse
    {
        $coupon->delete();

        return back()->with('success', 'Coupon deleted.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?Coupon $coupon = null): array
    {
        return $request->validate([
            'code' => [
                'required', 'string', 'max:50',
                Rule::unique('coupons', 'code')
                    ->where('studio_id', app('current.studio.id'))
                    ->ignore($coupon?->id),
            ],
            'type' => ['required', Rule::in(['percent', 'fixed', 'free_shipping', 'free_giveaway'])],
            'value' => 'required|integer|min:0',
            'currency' => ['required', 'string', Rule::in(Currencies::codes())],
            'min_subtotal_cents' => 'nullable|integer|min:0',
            'max_redemptions' => 'nullable|integer|min:1',
            'active' => 'boolean',
            'show_banner' => 'boolean',
            'banner_text' => 'nullable|string|max:255',
            'starts_at' => 'nullable|date',
            'expires_at' => 'nullable|date',
        ]);
    }
}
