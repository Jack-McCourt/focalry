<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Package;
use App\Models\PackageBooking;
use App\Models\Studio;
use App\Services\PackageFulfillment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Stripe\StripeClient;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class PublicPackageController extends Controller
{
    private string $studioSlug = '';

    public function index(Request $request, string $slug): Response
    {
        $studio = $this->resolveStudio($slug);
        $this->studioSlug = $studio->slug;

        $packages = Package::withoutGlobalScopes()
            ->where('studio_id', $studio->id)
            ->where('active', true)
            ->orderBy('sort_order')->orderBy('name')
            ->get()
            ->map(fn (Package $p) => $this->payload($p));

        return Inertia::render('Public/Packages/Index', [
            'studio' => ['name' => $studio->name, 'slug' => $studio->slug, 'logo_url' => $studio->logoUrl()],
            'packages' => $packages,
            'embed' => $request->boolean('embed'),
            'can_pay' => $studio->stripe_connect_status === 'active',
        ]);
    }

    /** Public page for a single payment link (its own shareable URL). */
    public function show(Request $request, string $slug, string $package): Response
    {
        $studio = $this->resolveStudio($slug);
        $this->studioSlug = $studio->slug;

        $record = Package::withoutGlobalScopes()
            ->where('studio_id', $studio->id)->where('slug', $package)->where('active', true)
            ->firstOrFail();

        return Inertia::render('Public/Packages/Show', [
            'studio' => ['name' => $studio->name, 'slug' => $studio->slug, 'logo_url' => $studio->logoUrl()],
            'package' => $this->payload($record),
            'embed' => $request->boolean('embed'),
            'can_pay' => $studio->stripe_connect_status === 'active',
        ]);
    }

    public function checkout(Request $request, string $slug, string $package): RedirectResponse|SymfonyResponse
    {
        $studio = $this->resolveStudio($slug);
        $record = Package::withoutGlobalScopes()
            ->where('studio_id', $studio->id)->where('slug', $package)->where('active', true)
            ->firstOrFail();

        $data = $request->validate([
            'client_name' => 'required|string|max:255',
            'client_email' => 'required|email|max:255',
            'client_phone' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:5000',
            'payment_type' => 'nullable|in:full,deposit',
            'amount_cents' => 'nullable|integer|min:0',
        ]);

        if ($record->isFlexible()) {
            // Customer-chosen amount (tip jar / pay what you want).
            $amount = (int) ($data['amount_cents'] ?? 0);
            $min = max((int) ($record->min_amount_cents ?? 0), 1);
            if ($amount < $min) {
                return back()->withErrors(['amount_cents' => 'Please enter an amount of at least '.number_format($min / 100, 2).' '.strtoupper($record->currency).'.']);
            }
            $payDeposit = false;
        } else {
            $payDeposit = ($data['payment_type'] ?? 'full') === 'deposit' && $record->offersDeposit();
            $amount = $payDeposit ? (int) $record->deposit_cents : (int) $record->price_cents;
        }

        $booking = DB::transaction(function () use ($studio, $record, $data, $payDeposit, $amount) {
            $contact = Contact::withoutGlobalScopes()
                ->where('studio_id', $studio->id)->where('email', $data['client_email'])->first()
                ?? Contact::create([
                    'studio_id' => $studio->id,
                    'first_name' => trim(explode(' ', $data['client_name'], 2)[0]),
                    'last_name' => trim(explode(' ', $data['client_name'], 2)[1] ?? ''),
                    'email' => $data['client_email'],
                    'phone' => $data['client_phone'] ?? null,
                    'status' => 'lead',
                ]);

            return PackageBooking::create([
                'studio_id' => $studio->id,
                'package_id' => $record->id,
                'contact_id' => $contact->id,
                'client_name' => $data['client_name'],
                'client_email' => $data['client_email'],
                'client_phone' => $data['client_phone'] ?? null,
                'notes' => $data['notes'] ?? null,
                'amount_cents' => $amount,
                'payment_type' => $payDeposit ? 'deposit' : 'full',
                'currency' => $record->currency,
                'status' => 'pending',
            ]);
        });

        // Free package (or zero amount): fulfil immediately, no Stripe needed.
        if ($amount <= 0) {
            app(PackageFulfillment::class)->markPaid($booking, null, 0);

            return redirect()->route('packages.public.confirmation', $booking->public_id);
        }

        abort_unless($studio->stripe_connect_status === 'active', 403, 'Online payment isn’t available yet.');

        $fee = (int) round($amount * $studio->effectiveCommissionRate() / 100);
        $paymentIntentData = ['metadata' => ['package_booking_id' => $booking->id]];
        if ($fee > 0) {
            $paymentIntentData['application_fee_amount'] = $fee;
        }

        $stripe = new StripeClient(config('services.stripe.secret'));

        try {
            $session = $stripe->checkout->sessions->create([
                'mode' => 'payment',
                'line_items' => [[
                    'price_data' => [
                        'currency' => $record->currency,
                        'product_data' => ['name' => $record->name.($payDeposit ? ' (deposit)' : '')],
                        'unit_amount' => $amount,
                    ],
                    'quantity' => 1,
                ]],
                'payment_intent_data' => $paymentIntentData,
                'metadata' => ['package_booking_id' => $booking->id],
                'success_url' => route('packages.public.confirmation', $booking->public_id).'?paid=1',
                'cancel_url' => route('packages.public', $studio->slug),
            ], ['stripe_account' => $studio->stripe_connect_id]);
        } catch (\Throwable $e) {
            report($e);

            return redirect()->route('packages.public', $studio->slug)
                ->with('error', 'Sorry, we couldn’t start the payment. Please try again.');
        }

        $booking->update(['stripe_session_id' => $session->id]);

        return Inertia::location($session->url);
    }

    public function confirmation(string $booking): Response
    {
        $record = PackageBooking::withoutGlobalScopes()->with('package')->where('public_id', $booking)->firstOrFail();
        $studio = Studio::findOrFail($record->studio_id);

        return Inertia::render('Public/Packages/Confirmation', [
            'studio' => ['name' => $studio->name, 'slug' => $studio->slug, 'logo_url' => $studio->logoUrl()],
            'booking' => [
                'client_name' => $record->client_name,
                'package' => $record->package?->name,
                'amount_cents' => $record->amount_cents,
                'currency' => $record->currency,
                'payment_type' => $record->payment_type,
                'status' => $record->status,
            ],
        ]);
    }

    private function resolveStudio(string $slug): Studio
    {
        return Studio::where('slug', $slug)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(Package $p): array
    {
        return [
            'slug' => $p->slug,
            'name' => $p->name,
            'description' => $p->description,
            'details' => $p->details,
            'image_url' => $p->imageUrl(),
            'pricing_type' => $p->pricing_type,
            'price_cents' => $p->price_cents,
            'deposit_cents' => $p->offersDeposit() ? $p->deposit_cents : null,
            'min_amount_cents' => $p->min_amount_cents,
            'suggested_amount_cents' => $p->suggested_amount_cents,
            'currency' => $p->currency,
            'url' => route('packages.public.show', [$this->studioSlug, $p->slug]),
        ];
    }
}
