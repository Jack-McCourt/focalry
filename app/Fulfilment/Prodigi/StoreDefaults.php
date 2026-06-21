<?php

namespace App\Fulfilment\Prodigi;

use App\Models\PriceSheet;
use App\Models\Product;
use App\Models\Studio;
use Illuminate\Support\Facades\DB;

/**
 * Seeds a new studio with a ready-to-sell store: a default lab (Prodigi) price
 * sheet pre-filled with the catalogue's default products, so the store isn't
 * empty out of the box. Idempotent — skips a studio that already has a sheet.
 */
class StoreDefaults
{
    public function seedFor(Studio $studio): ?PriceSheet
    {
        $exists = PriceSheet::withoutGlobalScopes()->where('studio_id', $studio->id)->exists();
        if ($exists) {
            return null;
        }

        return DB::transaction(function () use ($studio) {
            $sheet = PriceSheet::withoutGlobalScopes()->create([
                'studio_id' => $studio->id,
                'name' => 'Default price sheet',
                'is_default' => true,
                'fulfilment' => 'lab',
                'currency' => $studio->default_currency ?? 'gbp',
            ]);

            foreach (Catalogue::defaults() as $position => $catalogue) {
                $product = Product::withoutGlobalScopes()->create([
                    'studio_id' => $studio->id,
                    'price_sheet_id' => $sheet->id,
                    'type' => 'print',
                    'lab_product_key' => $catalogue['key'],
                    'name' => $catalogue['name'],
                    'description' => $catalogue['description'] ?? null,
                    'active' => true,
                    'position' => $position,
                ]);

                foreach (array_values($catalogue['sizes']) as $i => $size) {
                    $product->options()->create([
                        'studio_id' => $studio->id,
                        'lab_sku' => $size['sku'],
                        'name' => $size['label'],
                        'price_cents' => $size['suggested_price_cents'],
                        'cogs_cents' => $size['cogs_cents'],
                        'active' => true,
                        'position' => $i,
                    ]);
                }
            }

            return $sheet;
        });
    }
}
