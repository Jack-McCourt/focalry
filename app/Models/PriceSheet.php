<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PriceSheet extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'name',
        'is_default',
        'fulfilment',
        'currency',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
        ];
    }

    public function categories(): HasMany
    {
        return $this->hasMany(ProductCategory::class)->orderBy('position');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class)->orderBy('position');
    }

    public function collections(): HasMany
    {
        return $this->hasMany(Collection::class);
    }
}
