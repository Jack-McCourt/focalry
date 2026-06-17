<?php

namespace App\Http\Controllers\Stripe;

use App\Http\Controllers\Controller;
use App\Models\Studio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Stripe\StripeClient;
use Symfony\Component\HttpFoundation\Response;

class ConnectController extends Controller
{
    private function stripe(): StripeClient
    {
        return new StripeClient(config('services.stripe.secret'));
    }

    private function studio(): Studio
    {
        return Studio::findOrFail(app('current.studio.id'));
    }

    /**
     * Create (if needed) the studio's Express connected account and send them
     * to Stripe's hosted onboarding.
     */
    public function onboard(): RedirectResponse|Response
    {
        $studio = $this->studio();
        $stripe = $this->stripe();

        try {
            $this->ensureAccount($studio, $stripe);

            $link = $stripe->accountLinks->create([
                'account' => $studio->stripe_connect_id,
                'refresh_url' => route('stripe.connect.return'),
                'return_url' => route('stripe.connect.return'),
                'type' => 'account_onboarding',
            ]);
        } catch (\Throwable $e) {
            report($e);

            return redirect()->route('profile.edit')->with('error', $this->friendlyStripeError($e));
        }

        // External redirect via Inertia.
        return Inertia::location($link->url);
    }

    private function friendlyStripeError(\Throwable $e): string
    {
        $message = $e->getMessage();

        if (str_contains($message, 'signed up for Connect')) {
            return 'Stripe Connect isn’t enabled on your account yet. Enable it at dashboard.stripe.com/connect (test mode), then try again.';
        }

        return 'Couldn’t connect to Stripe: '.$message;
    }

    /**
     * Landing after onboarding (or refresh) — re-sync the account status.
     */
    public function return(): RedirectResponse
    {
        $studio = $this->studio();

        try {
            if ($studio->stripe_connect_id) {
                $account = $this->stripe()->accounts->retrieve($studio->stripe_connect_id);

                $studio->update([
                    'stripe_connect_status' => $account->charges_enabled ? 'active' : 'pending',
                ]);
            }
        } catch (\Throwable $e) {
            report($e);

            return redirect()->route('profile.edit')->with('error', $this->friendlyStripeError($e));
        }

        return redirect()->route('profile.edit')->with(
            'success',
            $studio->fresh()->stripe_connect_status === 'active'
                ? 'Stripe connected — you can now accept online payments.'
                : 'Stripe onboarding started. Finish the remaining steps to accept payments.',
        );
    }

    /**
     * Create an Account Session for the embedded onboarding component.
     */
    public function accountSession(): JsonResponse
    {
        $studio = $this->studio();
        $stripe = $this->stripe();

        try {
            $this->ensureAccount($studio, $stripe);

            $session = $stripe->accountSessions->create([
                'account' => $studio->stripe_connect_id,
                'components' => [
                    'account_onboarding' => ['enabled' => true],
                ],
            ]);

            return response()->json(['client_secret' => $session->client_secret]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => $this->friendlyStripeError($e)], 422);
        }
    }

    /**
     * Re-sync the connected account status (called when embedded onboarding exits).
     */
    public function refreshStatus(): JsonResponse
    {
        $studio = $this->studio();

        try {
            if ($studio->stripe_connect_id) {
                $account = $this->stripe()->accounts->retrieve($studio->stripe_connect_id);
                $studio->update([
                    'stripe_connect_status' => $account->charges_enabled ? 'active' : 'pending',
                ]);
            }

            return response()->json(['status' => $studio->fresh()->stripe_connect_status]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => $this->friendlyStripeError($e)], 422);
        }
    }

    private function ensureAccount(Studio $studio, StripeClient $stripe): void
    {
        if ($studio->stripe_connect_id) {
            return;
        }

        $account = $stripe->accounts->create([
            'type' => 'express',
            'email' => $studio->email,
            'country' => $studio->country ?: 'US',
            'capabilities' => [
                'card_payments' => ['requested' => true],
                'transfers' => ['requested' => true],
            ],
            'business_profile' => ['name' => $studio->name],
            'metadata' => ['studio_id' => $studio->id],
        ]);

        $studio->update([
            'stripe_connect_id' => $account->id,
            'stripe_connect_status' => 'pending',
        ]);
    }
}
