<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShippingMethod extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'name',
        'price_cents',
        'is_pickup',
        'active',
        'position',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'price_cents' => 'integer',
            'is_pickup' => 'boolean',
            'active' => 'boolean',
            'position' => 'integer',
        ];
    }
}
