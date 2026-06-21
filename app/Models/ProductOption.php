<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductOption extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'product_id',
        'lab_sku',
        'name',
        'price_cents',
        'cogs_cents',
        'active',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'price_cents' => 'integer',
            'cogs_cents' => 'integer',
            'active' => 'boolean',
            'position' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
