<?php

namespace App\Services\Store;

use App\Models\Coupon;
use App\Models\GiftCard;
use App\Models\ShippingMethod;
use App\Models\TaxRate;

/**
 * The computed totals for a cart. All amounts are integer minor units.
 * `payout = total − platformFee − cogs` models the studio's net after the
 * platform commission and lab cost-of-goods (even when the lab is manual).
 *
 * @param  list<LineItem>  $lines
 */
class PriceQuote
{
    public function __construct(
        public readonly array $lines,
        public readonly string $currency,
        public readonly int $subtotalCents,
        public readonly int $discountCents,
        public readonly int $shippingCents,
        public readonly int $taxCents,
        public readonly int $giftCardCents,
        public readonly int $totalCents,
        public readonly int $platformFeeCents,
        public readonly int $cogsCents,
        public readonly int $payoutCents,
        public readonly ?Coupon $coupon,
        public readonly ?GiftCard $giftCard,
        public readonly ?ShippingMethod $shippingMethod,
        public readonly ?TaxRate $taxRate,
        public readonly bool $digitalOnly,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'currency' => $this->currency,
            'subtotal_cents' => $this->subtotalCents,
            'discount_cents' => $this->discountCents,
            'shipping_cents' => $this->shippingCents,
            'tax_cents' => $this->taxCents,
            'gift_card_cents' => $this->giftCardCents,
            'total_cents' => $this->totalCents,
            'platform_fee_cents' => $this->platformFeeCents,
            'cogs_cents' => $this->cogsCents,
            'payout_cents' => $this->payoutCents,
            'coupon_code' => $this->coupon?->code,
            'digital_only' => $this->digitalOnly,
        ];
    }
}
