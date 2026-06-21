<?php

namespace App\Fulfilment\Prodigi;

/**
 * The curated set of Prodigi products a studio can sell as lab-fulfilled items.
 *
 * Prodigi is currently the only lab partner, so this catalogue is the single
 * source of truth for what "lab" products exist. Each size maps to a real
 * Prodigi SKU plus an estimated cost-of-goods (used for the order payout ledger)
 * and a suggested retail price (a starting point — the studio edits it).
 *
 * ⚠️ SKUs and `cogs_cents` are starting values and MUST be reconciled against
 *    your live Prodigi dashboard (Get Product Details / Quotes API), as Prodigi
 *    pricing varies by destination and currency. Costs here are GBP minor units.
 *    Changing a SKU/cost is a one-line data edit — nothing else depends on it.
 *
 * @phpstan-type Size array{sku: string, label: string, cogs_cents: int, suggested_price_cents: int}
 * @phpstan-type CatalogueProduct array{key: string, name: string, category: string, description: string, default: bool, sizing: string, sizes: list<Size>}
 */
class Catalogue
{
    /** @var array<int, array<string, mixed>> */
    public const PRODUCTS = [
        [
            'key' => 'photo-print-lustre',
            'name' => 'Photo Print (Lustre)',
            'category' => 'Photo prints',
            'description' => 'Premium lustre photographic print.',
            'default' => true,
            'sizing' => 'fillPrintArea',
            'sizes' => [
                ['sku' => 'GLOBAL-PHO-6X4', 'label' => '6×4″', 'cogs_cents' => 50, 'suggested_price_cents' => 600],
                ['sku' => 'GLOBAL-PHO-7X5', 'label' => '7×5″', 'cogs_cents' => 70, 'suggested_price_cents' => 800],
                ['sku' => 'GLOBAL-PHO-10X8', 'label' => '10×8″', 'cogs_cents' => 150, 'suggested_price_cents' => 1800],
                ['sku' => 'GLOBAL-PHO-A4', 'label' => 'A4', 'cogs_cents' => 220, 'suggested_price_cents' => 2500],
            ],
        ],
        [
            'key' => 'fine-art-print',
            'name' => 'Fine Art Print',
            'category' => 'Photo prints',
            'description' => 'Giclée fine-art print on heavyweight matte paper.',
            'default' => true,
            'sizing' => 'fillPrintArea',
            'sizes' => [
                ['sku' => 'GLOBAL-FAP-A4', 'label' => 'A4', 'cogs_cents' => 450, 'suggested_price_cents' => 3500],
                ['sku' => 'GLOBAL-FAP-A3', 'label' => 'A3', 'cogs_cents' => 700, 'suggested_price_cents' => 5500],
                ['sku' => 'GLOBAL-FAP-A2', 'label' => 'A2', 'cogs_cents' => 1100, 'suggested_price_cents' => 8500],
            ],
        ],
        [
            'key' => 'canvas',
            'name' => 'Stretched Canvas',
            'category' => 'Wall art',
            'description' => 'Gallery-wrapped stretched canvas, ready to hang.',
            'default' => true,
            'sizing' => 'fillPrintArea',
            'sizes' => [
                ['sku' => 'GLOBAL-CAN-10X10', 'label' => '10×10″', 'cogs_cents' => 1400, 'suggested_price_cents' => 5500],
                ['sku' => 'GLOBAL-CAN-16X20', 'label' => '16×20″', 'cogs_cents' => 2600, 'suggested_price_cents' => 9500],
                ['sku' => 'GLOBAL-CAN-20X30', 'label' => '20×30″', 'cogs_cents' => 3900, 'suggested_price_cents' => 14500],
            ],
        ],
        [
            'key' => 'framed-print',
            'name' => 'Framed Print',
            'category' => 'Wall art',
            'description' => 'Photographic print in a classic moulded frame.',
            'default' => false,
            'sizing' => 'fillPrintArea',
            'sizes' => [
                ['sku' => 'GLOBAL-CFPM-16X20', 'label' => '16×20″', 'cogs_cents' => 3200, 'suggested_price_cents' => 11500],
                ['sku' => 'GLOBAL-CFPM-A2', 'label' => 'A2', 'cogs_cents' => 3800, 'suggested_price_cents' => 13500],
            ],
        ],
    ];

    /** @return list<array<string, mixed>> */
    public static function all(): array
    {
        return self::PRODUCTS;
    }

    /** @return array<string, mixed>|null */
    public static function find(string $key): ?array
    {
        foreach (self::PRODUCTS as $product) {
            if ($product['key'] === $key) {
                return $product;
            }
        }

        return null;
    }

    /** Catalogue products flagged as defaults (used to seed a new studio's store). */
    public static function defaults(): array
    {
        return array_values(array_filter(self::PRODUCTS, fn ($p) => $p['default']));
    }

    public static function sizingFor(string $key): string
    {
        return self::find($key)['sizing'] ?? 'fillPrintArea';
    }
}
