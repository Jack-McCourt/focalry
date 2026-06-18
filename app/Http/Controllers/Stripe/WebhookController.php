<?php

namespace App\Http\Controllers\Stripe;

use App\Models\Invoice;
use App\Models\PackageBooking;
use App\Models\Studio;
use App\Services\PackageFulfillment;
use Laravel\Cashier\Http\Controllers\WebhookController as CashierWebhookController;

class WebhookController extends CashierWebhookController
{
    // Extend Cashier's webhook controller to handle Stripe Connect events
    // and any custom platform-level webhook logic.
    //
    // Methods follow the pattern: handleEventName(array $payload)
    // Cashier handles subscription lifecycle events automatically.

    protected function handlePaymentIntentSucceeded(array $payload): void
    {
        // Handled by Store order fulfillment (Phase 2).
    }

    /**
     * Client paid an invoice via Stripe Checkout — record the payment.
     * Stripe is the source of truth; payments are never marked from the client.
     */
    protected function handleCheckoutSessionCompleted(array $payload): void
    {
        $session = $payload['data']['object'] ?? [];

        if (($session['payment_status'] ?? null) !== 'paid') {
            return;
        }

        // A package booking was paid → mark it paid and create the Project.
        if ($packageBookingId = $session['metadata']['package_booking_id'] ?? null) {
            $booking = PackageBooking::withoutGlobalScopes()->find($packageBookingId);
            if ($booking) {
                app(PackageFulfillment::class)->markPaid(
                    $booking,
                    $session['payment_intent'] ?? null,
                    (int) ($session['amount_total'] ?? 0),
                );
            }

            return;
        }

        $invoiceId = $session['metadata']['invoice_id'] ?? null;
        if (! $invoiceId) {
            return;
        }

        $invoice = Invoice::withoutGlobalScopes()->find($invoiceId);
        if (! $invoice) {
            return;
        }

        $paymentIntent = $session['payment_intent'] ?? null;
        $amount = (int) ($session['amount_total'] ?? 0);

        if ($amount <= 0) {
            return;
        }

        // Idempotent: Stripe may deliver the event more than once.
        if ($paymentIntent && $invoice->payments()->where('reference', $paymentIntent)->exists()) {
            return;
        }

        $invoice->payments()->create([
            'amount_cents' => $amount,
            'method' => 'stripe',
            'reference' => $paymentIntent,
            'paid_on' => now()->toDateString(),
        ]);

        $invoice->syncPaymentState();
    }

    protected function handleAccountUpdated(array $payload): void
    {
        // Stripe Connect: sync studio's connect account status.
        $accountId = $payload['data']['object']['id'] ?? null;

        if ($accountId) {
            Studio::query()
                ->where('stripe_connect_id', $accountId)
                ->update([
                    'stripe_connect_status' => $payload['data']['object']['charges_enabled']
                        ? 'active'
                        : 'pending',
                ]);
        }
    }
}
