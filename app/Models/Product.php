<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use App\Models\Concerns\HasPublicImage;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use BelongsToStudio, HasFactory, HasPublicImage;

    protected $fillable = [
        'studio_id',
        'price_sheet_id',
        'category_id',
        'type',
        'lab_product_key',
        'name',
        'description',
        'image_path',
        'digital_resolution',
        'active',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'position' => 'integer',
        ];
    }

    public function priceSheet(): BelongsTo
    {
        return $this->belongsTo(PriceSheet::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function options(): HasMany
    {
        return $this->hasMany(ProductOption::class)->orderBy('position');
    }

    /** Whether this product is delivered digitally (no physical fulfilment). */
    public function isDigital(): bool
    {
        return $this->type === 'digital';
    }

    /** Whether this product is fulfilled by the print lab (Prodigi). */
    public function isLab(): bool
    {
        return $this->lab_product_key !== null;
    }

    /**
     * How an order item for this product is fulfilled — decided per product, so a
     * single price sheet can mix lab, self, and digital products.
     */
    public function fulfilmentMode(): string
    {
        return match (true) {
            $this->type === 'digital' => 'digital',
            $this->isLab() => 'auto',   // routed to Prodigi
            default => 'self',
        };
    }
}
