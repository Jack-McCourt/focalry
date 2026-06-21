<?php

namespace App\Services\Store;

use App\Models\Coupon;
use App\Models\GiftCard;
use App\Models\ShippingMethod;
use App\Models\Studio;
use App\Models\TaxRate;

/**
 * Pure pricing math for the store. Given resolved cart lines plus optional
 * coupon / gift card / shipping / tax modifiers, computes every amount on an
 * order. No persistence and no side effects — safe to call for live "quote"
 * previews and again at checkout.
 *
 * Order of operations:
 *   subtotal → discount → (taxable = subtotal − discount) → tax
 *   → shipping → gift card → total → platform fee + cogs → payout
 */
class PricingEngine
{
    /**
     * @param  list<LineItem>  $lines
     */
    public function quote(
        array $lines,
        Studio $studio,
        ?Coupon $coupon = null,
        ?GiftCard $giftCard = null,
        ?ShippingMethod $shippingMethod = null,
        ?TaxRate $taxRate = null,
        int $extraCogsCents = 0,
    ): PriceQuote {
        $currency = $studio->default_currency ?? 'gbp';

        $subtotal = array_sum(array_map(fn (LineItem $l) => $l->lineTotalCents(), $lines));
        // Item COGS + any extra lab cost the studio is billed (e.g. Prodigi shipping).
        $cogs = array_sum(array_map(fn (LineItem $l) => $l->lineCogsCents(), $lines)) + $extraCogsCents;

        $digitalOnly = $lines !== [] && collect($lines)->every(fn (LineItem $l) => $l->fulfilment() === 'digital');

        // ── Discount ───────────────────────────────────────────────────────
        $discount = 0;
        $freeShipping = false;
        if ($coupon && $coupon->isRedeemable($subtotal)) {
            $discount = match ($coupon->type) {
                'percent' => (int) round($subtotal * min(100, max(0, $coupon->value)) / 100),
                'fixed' => min((int) $coupon->value, $subtotal),
                'free_giveaway' => $this->cheapestUnitPrice($lines),
                default => 0, // free_shipping has no line discount
            };
            $freeShipping = $coupon->freeShipping();
        } else {
            $coupon = null; // not applicable — don't attach to the order
        }
        $discount = min($discount, $subtotal);
        $discountedSubtotal = $subtotal - $discount;

        // ── Shipping ─────────────────────────────────────────────────────────
        $shipping = 0;
        if (! $digitalOnly && $shippingMethod && ! $shippingMethod->is_pickup) {
            $shipping = (int) $shippingMethod->price_cents;
        }
        if ($freeShipping) {
            $shipping = 0;
        }

        // ── Tax (on goods, after discount) ────────────────────────────────────
        $tax = 0;
        if ($taxRate && $taxRate->active) {
            $tax = (int) round($discountedSubtotal * $taxRate->rate_bps / 10000);
        }

        $preGiftTotal = $discountedSubtotal + $shipping + $tax;

        // ── Gift card / store credit ──────────────────────────────────────────
        $giftCardApplied = 0;
        if ($giftCard && $giftCard->isUsable()) {
            $giftCardApplied = min((int) $giftCard->balance_cents, $preGiftTotal);
        } else {
            $giftCard = null;
        }

        $total = max(0, $preGiftTotal - $giftCardApplied);

        // ── Ledger: platform commission + lab COGS → studio payout ────────────
        $platformFee = (int) round($total * $studio->effectiveCommissionRate() / 100);
        $payout = $total - $platformFee - $cogs;

        return new PriceQuote(
            lines: $lines,
            currency: $currency,
            subtotalCents: $subtotal,
            discountCents: $discount,
            shippingCents: $shipping,
            taxCents: $tax,
            giftCardCents: $giftCardApplied,
            totalCents: $total,
            platformFeeCents: $platformFee,
            cogsCents: $cogs,
            payoutCents: $payout,
            coupon: $coupon,
            giftCard: $giftCard,
            shippingMethod: $shippingMethod,
            taxRate: $taxRate,
            digitalOnly: $digitalOnly,
        );
    }

    /** @param  list<LineItem>  $lines */
    private function cheapestUnitPrice(array $lines): int
    {
        $prices = array_map(fn (LineItem $l) => $l->unitPriceCents(), $lines);

        return $prices === [] ? 0 : min($prices);
    }
}
