<?php

namespace App\Services\Store;

use App\Models\Order;
use Illuminate\Validation\ValidationException;
use Stripe\StripeClient;

/**
 * Issues refunds against an order's Stripe payment (on the studio's connected
 * account) and records them in the per-order ledger.
 */
class RefundService
{
    public function refund(Order $order, int $amountCents, ?string $reason = null): void
    {
        $amountCents = min($amountCents, $order->refundableCents());
        if ($amountCents <= 0) {
            throw ValidationException::withMessages(['amount' => 'Nothing left to refund.']);
        }

        $stripeRefundId = null;

        if ($order->payment_method === 'stripe' && $order->stripe_payment_intent) {
            $stripe = new StripeClient(config('services.stripe.secret'));
            $refund = $stripe->refunds->create([
                'payment_intent' => $order->stripe_payment_intent,
                'amount' => $amountCents,
            ], ['stripe_account' => $order->studio->stripe_connect_id]);
            $stripeRefundId = $refund->id;
        }

        $order->refunds()->create([
            'studio_id' => $order->studio_id,
            'amount_cents' => $amountCents,
            'reason' => $reason,
            'stripe_refund_id' => $stripeRefundId,
        ]);

        $order->refunded_cents += $amountCents;
        if ($order->refunded_cents >= $order->total_cents) {
            $order->status = 'refunded';
        }
        $order->save();
    }
}
