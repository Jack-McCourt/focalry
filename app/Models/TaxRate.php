<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TaxRate extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'name',
        'rate_bps',
        'region',
        'is_default',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'rate_bps' => 'integer',
            'is_default' => 'boolean',
            'active' => 'boolean',
        ];
    }
}
