<?php

namespace App\Services\Store;

use App\Models\Collection;
use App\Models\Contact;
use App\Models\Order;
use App\Models\Studio;
use Illuminate\Support\Facades\DB;

/**
 * Persists a cart + price quote into an Order (+ items) in `pending` state.
 * The order is only marked paid later, from a verified Stripe webhook (or an
 * explicit offline-payment action) — never from the client.
 */
class OrderService
{
    /**
     * @param  array{name: string, email: string, phone?: ?string}  $customer
     * @param  array<string, ?string>  $shipping
     */
    public function create(
        Studio $studio,
        ?Collection $collection,
        PriceQuote $quote,
        array $customer,
        array $shipping = [],
        string $paymentMethod = 'stripe',
    ): Order {
        return DB::transaction(function () use ($studio, $collection, $quote, $customer, $shipping, $paymentMethod) {
            $contact = $this->resolveContact($studio, $customer, $collection);

            $order = Order::create([
                'studio_id' => $studio->id,
                'collection_id' => $collection?->id,
                'price_sheet_id' => $collection?->effectivePriceSheetId(),
                'visitor_id' => $shipping['visitor_id'] ?? null,
                'contact_id' => $contact?->id,
                'customer_name' => $customer['name'],
                'customer_email' => $customer['email'],
                'customer_phone' => $customer['phone'] ?? null,
                'shipping_name' => $shipping['name'] ?? null,
                'shipping_line1' => $shipping['line1'] ?? null,
                'shipping_line2' => $shipping['line2'] ?? null,
                'shipping_city' => $shipping['city'] ?? null,
                'shipping_region' => $shipping['region'] ?? null,
                'shipping_postal_code' => $shipping['postal_code'] ?? null,
                'shipping_country' => $shipping['country'] ?? null,
                'shipping_method_id' => $quote->shippingMethod?->id,
                'coupon_id' => $quote->coupon?->id,
                'gift_card_id' => $quote->giftCard?->id,
                'status' => 'pending',
                'fulfilment' => $this->orderFulfilment($quote->lines),
                'currency' => $quote->currency,
                'subtotal_cents' => $quote->subtotalCents,
                'discount_cents' => $quote->discountCents,
                'gift_card_cents' => $quote->giftCardCents,
                'tax_cents' => $quote->taxCents,
                'shipping_cents' => $quote->shippingCents,
                'total_cents' => $quote->totalCents,
                'platform_fee_cents' => $quote->platformFeeCents,
                'cogs_cents' => $quote->cogsCents,
                'payout_cents' => $quote->payoutCents,
                'payment_method' => $paymentMethod,
            ]);

            foreach ($quote->lines as $line) {
                $order->items()->create([
                    'studio_id' => $studio->id,
                    'product_id' => $line->product->id,
                    'option_id' => $line->option->id,
                    'photo_id' => $line->photoId,
                    'type' => $line->product->type,
                    'description' => $line->description(),
                    'qty' => $line->qty,
                    'unit_price_cents' => $line->unitPriceCents(),
                    'cogs_cents' => $line->unitCogsCents(),
                    'line_total_cents' => $line->lineTotalCents(),
                    'fulfilment' => $line->fulfilment(),
                    'digital_resolution' => $line->product->isDigital() ? $line->product->digital_resolution : null,
                ]);
            }

            return $order;
        });
    }

    /** @param  list<LineItem>  $lines */
    private function orderFulfilment(array $lines): string
    {
        $modes = array_values(array_unique(array_map(fn (LineItem $l) => $l->fulfilment(), $lines)));

        return count($modes) === 1 ? $modes[0] : 'mixed';
    }

    /**
     * @param  array{name: string, email: string, phone?: ?string}  $customer
     */
    private function resolveContact(Studio $studio, array $customer, ?Collection $collection): ?Contact
    {
        if ($collection?->contact_id) {
            return Contact::withoutGlobalScopes()->find($collection->contact_id);
        }

        return Contact::withoutGlobalScopes()
            ->where('studio_id', $studio->id)->where('email', $customer['email'])->first()
            ?? Contact::create([
                'studio_id' => $studio->id,
                'first_name' => trim(explode(' ', $customer['name'], 2)[0]),
                'last_name' => trim(explode(' ', $customer['name'], 2)[1] ?? ''),
                'email' => $customer['email'],
                'phone' => $customer['phone'] ?? null,
                'status' => 'lead',
            ]);
    }
}
