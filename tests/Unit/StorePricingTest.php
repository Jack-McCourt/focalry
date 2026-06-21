<?php

use App\Models\Coupon;
use App\Models\GiftCard;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ShippingMethod;
use App\Models\Studio;
use App\Models\TaxRate;
use App\Services\Store\LineItem;
use App\Services\Store\PricingEngine;

/**
 * Build a LineItem without touching the DB scope: products/options just need
 * their pricing + type for the pure pricing math.
 */
function line(string $type, int $price, int $qty = 1, ?int $cogs = null, ?string $labKey = null): LineItem
{
    // Fulfilment is decided per product: a lab_product_key routes to the lab.
    $product = new Product(['type' => $type, 'lab_product_key' => $labKey]);
    $option = new ProductOption(['price_cents' => $price, 'cogs_cents' => $cogs]);

    return new LineItem($product, $option, $type === 'self' ? null : 1, $qty);
}

function freeStudio(int $commission = 15): Studio
{
    return new Studio(['plan' => 'free', 'commission_rate' => $commission, 'default_currency' => 'usd']);
}

it('sums a basic subtotal with no modifiers', function () {
    $quote = (new PricingEngine)->quote([line('print', 2000, 2), line('print', 1000)], freeStudio());

    expect($quote->subtotalCents)->toBe(5000)
        ->and($quote->totalCents)->toBe(5000)
        ->and($quote->shippingCents)->toBe(0)
        ->and($quote->taxCents)->toBe(0);
});

it('applies a percent coupon', function () {
    $coupon = new Coupon(['type' => 'percent', 'value' => 10, 'active' => true]);
    $quote = (new PricingEngine)->quote([line('print', 10000)], freeStudio(), coupon: $coupon);

    expect($quote->discountCents)->toBe(1000)->and($quote->totalCents)->toBe(9000);
});

it('caps a fixed coupon at the subtotal', function () {
    $coupon = new Coupon(['type' => 'fixed', 'value' => 99999, 'active' => true]);
    $quote = (new PricingEngine)->quote([line('print', 5000)], freeStudio(), coupon: $coupon);

    expect($quote->discountCents)->toBe(5000)->and($quote->totalCents)->toBe(0);
});

it('adds shipping for physical orders and zeroes it for digital-only', function () {
    $shipping = new ShippingMethod(['price_cents' => 1500, 'is_pickup' => false]);

    $physical = (new PricingEngine)->quote([line('print', 5000)], freeStudio(), shippingMethod: $shipping);
    expect($physical->shippingCents)->toBe(1500)->and($physical->totalCents)->toBe(6500);

    $digital = (new PricingEngine)->quote([line('digital', 5000)], freeStudio(), shippingMethod: $shipping);
    expect($digital->shippingCents)->toBe(0)->and($digital->digitalOnly)->toBeTrue();
});

it('free_shipping coupon removes shipping but keeps goods', function () {
    $coupon = new Coupon(['type' => 'free_shipping', 'value' => 0, 'active' => true]);
    $shipping = new ShippingMethod(['price_cents' => 2000, 'is_pickup' => false]);
    $quote = (new PricingEngine)->quote([line('print', 5000)], freeStudio(), coupon: $coupon, shippingMethod: $shipping);

    expect($quote->shippingCents)->toBe(0)->and($quote->totalCents)->toBe(5000);
});

it('taxes goods after discount', function () {
    $coupon = new Coupon(['type' => 'fixed', 'value' => 2000, 'active' => true]);
    $tax = new TaxRate(['rate_bps' => 1000, 'active' => true]); // 10%
    $quote = (new PricingEngine)->quote([line('print', 10000)], freeStudio(), coupon: $coupon, taxRate: $tax);

    // (10000 - 2000) * 10% = 800
    expect($quote->taxCents)->toBe(800)->and($quote->totalCents)->toBe(8800);
});

it('computes the commission + cogs ledger and studio payout', function () {
    $tax = new TaxRate(['rate_bps' => 0, 'active' => true]);
    $quote = (new PricingEngine)->quote([line('print', 10000, 1, 3000)], freeStudio(15), taxRate: $tax);

    // total 10000, fee 15% = 1500, cogs 3000, payout = 10000 - 1500 - 3000 = 5500
    expect($quote->totalCents)->toBe(10000)
        ->and($quote->platformFeeCents)->toBe(1500)
        ->and($quote->cogsCents)->toBe(3000)
        ->and($quote->payoutCents)->toBe(5500);
});

it('charges no commission on a paid plan', function () {
    $studio = new Studio(['plan' => 'plus', 'commission_rate' => 0, 'default_currency' => 'usd']);
    $quote = (new PricingEngine)->quote([line('print', 10000, 1, 2000)], $studio);

    expect($quote->platformFeeCents)->toBe(0)->and($quote->payoutCents)->toBe(8000);
});

it('applies a gift card after tax and shipping', function () {
    $card = new GiftCard(['balance_cents' => 3000, 'active' => true]);
    $shipping = new ShippingMethod(['price_cents' => 1000, 'is_pickup' => false]);
    $quote = (new PricingEngine)->quote([line('print', 5000)], freeStudio(), giftCard: $card, shippingMethod: $shipping);

    // preGift = 5000 + 1000 = 6000, gift card 3000 → total 3000
    expect($quote->giftCardCents)->toBe(3000)->and($quote->totalCents)->toBe(3000);
});

it('never lets a gift card make the total negative', function () {
    $card = new GiftCard(['balance_cents' => 99999, 'active' => true]);
    $quote = (new PricingEngine)->quote([line('print', 4000)], freeStudio(0), giftCard: $card);

    expect($quote->giftCardCents)->toBe(4000)->and($quote->totalCents)->toBe(0);
});

it('routes fulfilment per product: lab products to the lab, others to self/digital', function () {
    expect(line('print', 1000, 1, null, 'canvas')->fulfilment())->toBe('auto')  // has a lab_product_key
        ->and(line('print', 1000)->fulfilment())->toBe('self')                   // own print, no lab key
        ->and(line('digital', 1000)->fulfilment())->toBe('digital');
});
