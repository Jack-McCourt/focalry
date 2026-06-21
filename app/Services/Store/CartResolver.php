<?php

namespace App\Services\Store;

use App\Models\Collection;
use App\Models\Photo;
use App\Models\Product;
use App\Models\ProductOption;
use Illuminate\Support\Collection as LaravelCollection;
use Illuminate\Validation\ValidationException;

/**
 * Turns raw cart input (option_id, photo_id, qty) into validated, price-snapshotted
 * LineItems. Everything is checked against the collection's assigned price sheet and
 * scoped to the collection's studio — never trust client-supplied prices or studio.
 */
class CartResolver
{
    /**
     * @param  array<int, array{option_id: int|string, photo_id?: int|string|null, qty?: int|string}>  $rawItems
     * @return list<LineItem>
     */
    public function resolve(Collection $collection, array $rawItems): array
    {
        if (empty($rawItems)) {
            throw ValidationException::withMessages(['items' => 'Your cart is empty.']);
        }

        $priceSheetId = $collection->effectivePriceSheetId();
        if (! $priceSheetId) {
            throw ValidationException::withMessages(['items' => 'This gallery is not set up for sales.']);
        }

        // Load all options that belong to active products on this price sheet (tenant-scoped via collection studio).
        $optionIds = array_values(array_unique(array_map(fn ($i) => (int) ($i['option_id'] ?? 0), $rawItems)));

        $options = ProductOption::withoutGlobalScopes()
            ->where('studio_id', $collection->studio_id)
            ->where('active', true)
            ->whereIn('id', $optionIds)
            ->whereHas('product', function ($q) use ($priceSheetId) {
                $q->where('price_sheet_id', $priceSheetId)->where('active', true);
            })
            ->with('product')
            ->get()
            ->keyBy('id');

        // Validate photos belong to the collection.
        $photoIds = array_values(array_filter(array_map(fn ($i) => isset($i['photo_id']) ? (int) $i['photo_id'] : null, $rawItems)));
        $photos = $photoIds === []
            ? new LaravelCollection
            : Photo::withoutGlobalScopes()
                ->where('collection_id', $collection->id)
                ->whereIn('id', $photoIds)
                ->pluck('id')
                ->flip();

        $lines = [];
        foreach ($rawItems as $raw) {
            $option = $options->get((int) ($raw['option_id'] ?? 0));
            if (! $option) {
                throw ValidationException::withMessages(['items' => 'A selected product is no longer available.']);
            }

            $qty = max(1, (int) ($raw['qty'] ?? 1));
            $photoId = isset($raw['photo_id']) ? (int) $raw['photo_id'] : null;

            /** @var Product $product */
            $product = $option->product;

            // Print + digital products are tied to a specific photo; that photo must be in this collection.
            if (in_array($product->type, ['print', 'digital'], true)) {
                if (! $photoId || ! $photos->has($photoId)) {
                    throw ValidationException::withMessages(['items' => 'Please choose a valid photo for each print/download.']);
                }
            } else {
                $photoId = null; // packages / self-fulfilled items aren't photo-specific
            }

            $lines[] = new LineItem($product, $option, $photoId, $qty);
        }

        return $lines;
    }
}
