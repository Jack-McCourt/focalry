<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Package;
use App\Models\PackageBooking;
use App\Support\Currencies;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PackageController extends Controller
{
    public function index(): Response
    {
        $studio = auth()->user()->studio;
        $publicUrl = $studio ? route('packages.public', $studio->slug) : '';

        return Inertia::render('Packages/Index', [
            'packages' => Package::orderBy('sort_order')->orderBy('name')->withCount('bookings')->get()
                ->map(fn (Package $p) => [
                    ...$p->toArray(),
                    'image_url' => $p->imageUrl(),
                    'url' => $studio ? route('packages.public.show', [$studio->slug, $p->slug]) : null,
                ]),
            'bookings' => PackageBooking::with('package:id,name')->where('status', 'paid')->latest()->limit(50)->get()
                ->map(fn (PackageBooking $b) => [
                    'id' => $b->id,
                    'client_name' => $b->client_name,
                    'client_email' => $b->client_email,
                    'package' => $b->package?->name,
                    'amount_cents' => $b->amount_cents,
                    'currency' => $b->currency,
                    'payment_type' => $b->payment_type,
                    'project_id' => $b->project_id,
                    'created_at' => $b->created_at->toIso8601String(),
                ]),
            'default_currency' => $studio?->default_currency ?? 'gbp',
            'currencies' => collect(Currencies::CURRENCIES)->map(fn ($label, $code) => ['code' => $code, 'label' => $label])->values(),
            'public_url' => $publicUrl,
            'embed_code' => $publicUrl ? '<iframe src="'.$publicUrl.'?embed=1" style="width:100%;border:0;min-height:900px" title="Packages"></iframe>' : '',
            'stripe_ready' => $studio?->stripe_connect_status === 'active',
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $package = Package::create($this->validated($request));
        $this->handleImage($request, $package);

        return back()->with('success', 'Package created.');
    }

    public function update(Request $request, Package $package): RedirectResponse
    {
        $package->update($this->validated($request));
        $this->handleImage($request, $package);

        return back()->with('success', 'Package updated.');
    }

    public function destroy(Package $package): RedirectResponse
    {
        if ($package->image_path) {
            Storage::disk('wasabi')->delete($package->image_path);
        }
        $package->delete();

        return back()->with('success', 'Package deleted.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'details' => 'nullable|string|max:10000',
            'pricing_type' => ['nullable', Rule::in(['fixed', 'flexible'])],
            'price_cents' => 'required_unless:pricing_type,flexible|nullable|integer|min:0',
            'deposit_cents' => 'nullable|integer|min:0|lt:price_cents',
            'min_amount_cents' => 'nullable|integer|min:0',
            'suggested_amount_cents' => 'nullable|integer|min:0',
            'currency' => ['required', 'string', Rule::in(Currencies::codes())],
            'active' => 'boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $data['pricing_type'] ??= 'fixed';

        // A flexible "tip jar" link has no fixed price or deposit.
        if ($data['pricing_type'] === 'flexible') {
            $data['price_cents'] = 0;
            $data['deposit_cents'] = null;
        } else {
            $data['min_amount_cents'] = null;
            $data['suggested_amount_cents'] = null;
        }

        return $data;
    }

    private function handleImage(Request $request, Package $package): void
    {
        $request->validate(['image' => 'nullable|image|mimes:png,jpg,jpeg,webp|max:5120']);

        if ($request->hasFile('image')) {
            $package->replaceImage($request->file('image'), 'packages');
        }
    }
}
