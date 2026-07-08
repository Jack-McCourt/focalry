<?php

namespace App\Services\Store;

use App\Fulfilment\DigitalProvider;
use App\Fulfilment\FulfilmentManager;
use App\Mail\ClientMessage;
use App\Models\CreditLedgerEntry;
use App\Models\Order;
use App\Models\OrderItem;
use App\Support\Money;
use App\Support\StudioNotifications;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

/**
 * Marks store orders paid and drives fulfilment. Idempotent: safe to call from a
 * replayed Stripe webhook. Stripe is the source of truth for the amount paid.
 */
class OrderFulfillment
{
    public function __construct(private FulfilmentManager $fulfilment) {}

    /**
     * Record payment for an order. Redeems promotions, delivers digital items
     * immediately, and either fulfils physical items now or holds them for the
     * studio's review window.
     */
    public function markPaid(Order $order, ?string $paymentIntent, int $amountTotal, string $method = 'stripe'): void
    {
        if ($order->paid_at) {
            return;
        }

        // Bind the studio so BelongsToStudio scoping/assignment work off-request.
        app()->instance('current.studio.id', $order->studio_id);

        $settings = $order->studio->storeSettings();
        $hasPhysical = $order->items->contains(fn (OrderItem $i) => $i->fulfilment !== 'digital');
        $hold = $settings['hold_for_review'] && $hasPhysical;

        DB::transaction(function () use ($order, $paymentIntent, $amountTotal, $method, $hold, $settings) {
            $order->status = 'paid';
            $order->paid_at = now();
            $order->payment_method = $method;
            $order->stripe_payment_intent = $paymentIntent;
            if ($method === 'stripe' && $amountTotal > 0) {
                $order->total_cents = $amountTotal; // trust Stripe's amount
            }
            $order->fulfil_after = $hold ? now()->addHours($settings['review_window_hours']) : now();
            $order->save();

            $this->redeemCoupon($order);
            $this->redeemGiftCard($order);
        });

        // Digital items are delivered immediately, regardless of the review window.
        $digital = $order->items->where('fulfilment', 'digital')->values()->all();
        if ($digital !== []) {
            app(DigitalProvider::class)->fulfil($order, $digital);
        }

        $this->sendConfirmation($order);

        StudioNotifications::send(
            $order->studio_id,
            'store_order',
            'New store order',
            "{$order->customer_name} placed order {$order->number} for ".Money::format((int) $order->total_cents, $order->currency).'.',
            route('store.orders.show', $order->id),
        );

        if (! $hasPhysical) {
            // Digital-only order — fully delivered, nothing to fulfil physically.
            $order->update(['status' => 'completed', 'fulfilled_at' => now()]);

            return;
        }

        // Physical fulfilment runs now unless held for review (released later by store:release-orders).
        if (! $hold) {
            $this->fulfilPhysical($order);
        }
    }

    /** Record an offline (cash/bank/etc.) payment from the studio side. */
    public function markPaidOffline(Order $order): void
    {
        $this->markPaid($order, null, 0, 'offline');
    }

    /** Run physical (lab + self) fulfilment for an order whose review window has passed. */
    public function fulfilPhysical(Order $order): void
    {
        if ($order->fulfilled_at) {
            return;
        }

        $this->fulfilment->fulfil($order); // digital is idempotent, lab/self get notified
        $order->update([
            'fulfilled_at' => now(),
            'status' => $order->status === 'paid' ? 'in_production' : $order->status,
        ]);
    }

    private function redeemCoupon(Order $order): void
    {
        if ($order->coupon_id) {
            $order->coupon()->increment('redeemed_count');
        }
    }

    private function redeemGiftCard(Order $order): void
    {
        if (! $order->gift_card_id || $order->gift_card_cents <= 0) {
            return;
        }

        $card = $order->giftCard()->lockForUpdate()->first();
        if (! $card) {
            return;
        }

        // Guard against double-redemption on webhook replay.
        if (CreditLedgerEntry::withoutGlobalScopes()->where('order_id', $order->id)->where('delta_cents', '<', 0)->exists()) {
            return;
        }

        $applied = min($card->balance_cents, $order->gift_card_cents);
        $card->balance_cents -= $applied;
        $card->save();

        CreditLedgerEntry::create([
            'studio_id' => $order->studio_id,
            'gift_card_id' => $card->id,
            'order_id' => $order->id,
            'delta_cents' => -$applied,
            'balance_after_cents' => $card->balance_cents,
            'reason' => "Redeemed on order {$order->number}",
        ]);
    }

    private function sendConfirmation(Order $order): void
    {
        $details = [
            ['label' => 'Order', 'value' => $order->number],
            ['label' => 'Total', 'value' => $this->money($order->total_cents, $order->currency)],
        ];

        try {
            Mail::to($order->customer_email)->send(new ClientMessage(
                studioName: $order->studio->name ?? config('app.name'),
                subjectLine: "Order confirmed — {$order->number}",
                bodyText: "Thank you for your order, {$order->customer_name}! We've received your payment and your order is being processed.",
                ctaLabel: 'View order',
                ctaUrl: route('store.public.confirmation', $order->public_id),
                details: $details,
                logoUrl: $order->studio?->logoUrl(),
                logoHeight: $order->studio?->emailLogoHeight(),
            ));
        } catch (\Throwable $e) {
            report($e);
        }
    }

    private function money(int $cents, string $currency): string
    {
        return strtoupper($currency).' '.number_format($cents / 100, 2);
    }
}
