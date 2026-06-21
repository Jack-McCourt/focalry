<?php

namespace App\Services\Store;

use App\Models\Product;
use App\Models\ProductOption;

/**
 * A resolved cart line: a product option, optionally tied to a photo, with a
 * quantity. Prices/COGS are snapshotted from the option at resolve time so the
 * order is unaffected by later price-sheet edits.
 */
class LineItem
{
    public function __construct(
        public readonly Product $product,
        public readonly ProductOption $option,
        public readonly ?int $photoId,
        public readonly int $qty,
    ) {}

    public function unitPriceCents(): int
    {
        return (int) $this->option->price_cents;
    }

    public function unitCogsCents(): int
    {
        return (int) ($this->option->cogs_cents ?? 0);
    }

    public function lineTotalCents(): int
    {
        return $this->unitPriceCents() * $this->qty;
    }

    public function lineCogsCents(): int
    {
        return $this->unitCogsCents() * $this->qty;
    }

    public function fulfilment(): string
    {
        return $this->product->fulfilmentMode();
    }

    public function description(): string
    {
        return "{$this->product->name} — {$this->option->name}";
    }
}
