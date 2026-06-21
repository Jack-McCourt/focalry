<?php

namespace App\Fulfilment;

use App\Fulfilment\Prodigi\Catalogue;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * Lab fulfilment via Prodigi (the only lab partner for now). Submits paid "auto"
 * order items to the Prodigi Print API; the studio is paid by the client (Stripe
 * Connect) while Prodigi bills the merchant account for the cost-of-goods.
 *
 * Degrades gracefully: if Prodigi isn't configured, or the API call fails, it
 * falls back to emailing the studio (ManualLabProvider) so an order is never lost.
 * Idempotent — a replayed webhook won't double-submit (guarded by lab_order_ref).
 */
class ProdigiProvider implements FulfilmentProvider
{
    public function __construct(private ManualLabProvider $fallback) {}

    public function mode(): string
    {
        return 'auto';
    }

    /** @param  list<OrderItem>  $items */
    public function fulfil(Order $order, array $items): void
    {
        if ($order->lab_order_ref) {
            return; // already submitted to the lab
        }

        if (! $this->configured()) {
            $this->fallback->fulfil($order, $items);

            return;
        }

        try {
            $response = Http::withHeaders(['X-API-Key' => config('services.prodigi.key')])
                ->acceptJson()
                ->post($this->baseUrl().'/Orders', $this->payload($order, $items));

            if (! $response->successful()) {
                throw new \RuntimeException('Prodigi order failed: '.$response->status().' '.$response->body());
            }

            $order->update(['lab_order_ref' => $response->json('order.id')]);
        } catch (\Throwable $e) {
            report($e);
            // Don't lose the order — notify the studio to place it manually.
            $this->fallback->fulfil($order, $items);
        }
    }

    /**
     * @param  list<OrderItem>  $items
     * @return array<string, mixed>
     */
    private function payload(Order $order, array $items): array
    {
        $payload = [
            'merchantReference' => $order->number,
            'shippingMethod' => config('services.prodigi.shipping_method', 'Standard'),
            'idempotencyKey' => $order->public_id,
            'metadata' => ['order_id' => $order->id],
            'recipient' => [
                'name' => $order->shipping_name ?: $order->customer_name,
                'email' => $order->customer_email,
                'address' => [
                    'line1' => $order->shipping_line1,
                    'line2' => $order->shipping_line2,
                    'townOrCity' => $order->shipping_city,
                    'stateOrCounty' => $order->shipping_region,
                    'postalOrZipCode' => $order->shipping_postal_code,
                    'countryCode' => $order->shipping_country,
                ],
            ],
            'items' => array_map(fn (OrderItem $i) => [
                'merchantReference' => (string) $i->id,
                'sku' => $i->option?->lab_sku,
                'copies' => $i->qty,
                'sizing' => Catalogue::sizingFor($i->product?->lab_product_key ?? ''),
                'assets' => [[
                    'printArea' => 'default',
                    'url' => $this->assetUrl($i),
                ]],
            ], $items),
        ];

        if ($secret = config('services.prodigi.callback_secret')) {
            $payload['callbackUrl'] = route('prodigi.callback', $secret);
        }

        return $payload;
    }

    /** A short-lived, publicly fetchable print-resolution URL for Prodigi to pull. */
    private function assetUrl(OrderItem $item): ?string
    {
        $photo = $item->photo;
        if (! $photo) {
            return null;
        }

        $key = $photo->derivativeKey('print') ?? $photo->derivativeKey('web') ?? $photo->wasabi_key_original;

        return $key ? Storage::disk('wasabi')->temporaryUrl($key, now()->addHours(24)) : null;
    }

    private function configured(): bool
    {
        return ! empty(config('services.prodigi.key'));
    }

    private function baseUrl(): string
    {
        return config('services.prodigi.sandbox', true)
            ? 'https://api.sandbox.prodigi.com/v4.0'
            : 'https://api.prodigi.com/v4.0';
    }
}
