<?php

namespace App\Fulfilment\Prodigi;

use Illuminate\Support\Facades\Http;

/**
 * Fetches live cost-of-goods from Prodigi's Quotes API so an order's payout
 * ledger reflects the real lab cost in the order currency (rather than the
 * catalogue's static estimates). Returns null when Prodigi isn't configured or
 * the call fails — callers then fall back to the catalogue estimate.
 */
class QuoteService
{
    /**
     * @param  list<array{sku: string, copies: int}>  $items
     * @return array{skus: array<string, int>, shipping_cents: int}|null
     */
    public function quote(array $items, string $destinationCountryCode, string $currency): ?array
    {
        if (empty($items) || empty(config('services.prodigi.key'))) {
            return null;
        }

        try {
            $response = Http::withHeaders(['X-API-Key' => config('services.prodigi.key')])
                ->acceptJson()
                ->post($this->baseUrl().'/quotes', [
                    // Quote shippingMethod is lowercase (vs PascalCase on orders).
                    'shippingMethod' => strtolower((string) config('services.prodigi.shipping_method', 'standard')),
                    'destinationCountryCode' => strtoupper($destinationCountryCode),
                    'currencyCode' => strtoupper($currency),
                    'items' => array_map(fn ($i) => [
                        'sku' => $i['sku'],
                        'copies' => $i['copies'],
                        'assets' => [['printArea' => 'default']],
                    ], $items),
                ]);

            if (! $response->successful()) {
                return null;
            }

            $quote = $response->json('quotes.0');
            if (! $quote) {
                return null;
            }

            $skus = [];
            foreach ($quote['items'] ?? [] as $item) {
                if (isset($item['sku'], $item['unitCost']['amount'])) {
                    $skus[$item['sku']] = $this->toCents($item['unitCost']['amount']);
                }
            }

            return [
                'skus' => $skus,
                'shipping_cents' => $this->toCents($quote['costSummary']['shipping']['amount'] ?? 0),
            ];
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }

    private function toCents(string|float|int $amount): int
    {
        return (int) round((float) $amount * 100);
    }

    private function baseUrl(): string
    {
        return config('services.prodigi.sandbox', true)
            ? 'https://api.sandbox.prodigi.com/v4.0'
            : 'https://api.prodigi.com/v4.0';
    }
}
