<?php

namespace App\Http\Controllers;

use App\Models\Studio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\Response;

class BillingController extends Controller
{
    private function studio(): Studio
    {
        return Studio::findOrFail(app('current.studio.id'));
    }

    /**
     * The pricing / plan management page: tier comparison, current plan,
     * storage usage and subscription state.
     */
    public function index(): InertiaResponse
    {
        $studio = $this->studio();
        $subscription = $studio->subscription('default');

        $tiers = collect(config('plans.order'))->map(function (string $key) {
            $tier = config("plans.tiers.$key");

            return [
                'key' => $key,
                'name' => $tier['name'],
                'tagline' => $tier['tagline'],
                'price' => $tier['price'],
                'storage' => $tier['storage'],
                'commission_rate' => $tier['commission_rate'],
                'features' => $tier['features'],
                'has_stripe_price' => ! empty($tier['stripe']['monthly']) || ! empty($tier['stripe']['yearly']),
            ];
        })->values();

        return Inertia::render('Billing/Index', [
            'tiers' => $tiers,
            'featureLabels' => config('plans.feature_labels'),
            'currency' => config('plans.currency', 'gbp'),
            'currentPlan' => $studio->planKey(),
            'storage' => [
                'used' => (int) $studio->storage_used,
                'limit' => $studio->storageLimit(),
            ],
            'subscription' => $subscription ? [
                'active' => $subscription->valid(),
                'on_grace_period' => $subscription->onGracePeriod(),
                'cancelled' => $subscription->canceled(),
                'ends_at' => $subscription->ends_at?->toIso8601String(),
            ] : null,
        ]);
    }

    /**
     * Start a subscription (or change plans). New customers go to Stripe
     * Checkout; existing subscribers swap in place. Downgrading to Free
     * cancels at period end.
     */
    public function subscribe(Request $request): RedirectResponse|Response
    {
        $validated = $request->validate([
            'plan' => 'required|string|in:'.implode(',', config('plans.order')),
            'interval' => 'required|in:monthly,yearly',
        ]);

        $studio = $this->studio();
        $planKey = $validated['plan'];

        // Downgrade to Free → cancel any active subscription at period end.
        if ($planKey === 'free') {
            if ($studio->subscribed('default')) {
                $studio->subscription('default')->cancel();

                return redirect()->route('billing.index')
                    ->with('success', 'Your plan will switch to Free at the end of the billing period.');
            }

            return redirect()->route('billing.index');
        }

        $priceId = config("plans.tiers.$planKey.stripe.".$validated['interval']);

        if (! $priceId) {
            throw ValidationException::withMessages([
                'plan' => 'This plan isn’t available for purchase yet. Set its Stripe price ID first.',
            ]);
        }

        // Already subscribed → swap the plan in place (proration handled by Stripe).
        if ($studio->subscribed('default')) {
            $studio->subscription('default')->swap($priceId);
            $studio->syncPlanFromSubscription();

            return redirect()->route('billing.index')
                ->with('success', 'Your plan has been updated.');
        }

        // New subscription → Stripe Checkout.
        $checkout = $studio->newSubscription('default', $priceId)->checkout([
            'success_url' => route('billing.success').'?session_id={CHECKOUT_SESSION_ID}',
            'cancel_url' => route('billing.index'),
        ]);

        return Inertia::location($checkout->url);
    }

    /**
     * Return from Stripe Checkout — sync the plan immediately so the UI
     * reflects it without waiting for the webhook.
     */
    public function success(): RedirectResponse
    {
        $studio = $this->studio();
        $studio->syncPlanFromSubscription();

        return redirect()->route('billing.index')
            ->with('success', 'Subscription active — welcome to '.$studio->planConfig()['name'].'!');
    }

    /**
     * Send the studio to Stripe's hosted billing portal to manage payment
     * methods, invoices and cancellation.
     */
    public function portal(): Response|RedirectResponse
    {
        $studio = $this->studio();

        if (! $studio->hasStripeId()) {
            return redirect()->route('billing.index')
                ->with('error', 'You don’t have a billing account yet — choose a plan first.');
        }

        return Inertia::location($studio->billingPortalUrl(route('billing.index')));
    }
}
