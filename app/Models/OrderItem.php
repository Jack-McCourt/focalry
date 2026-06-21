<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'order_id',
        'studio_id',
        'product_id',
        'option_id',
        'photo_id',
        'type',
        'description',
        'qty',
        'unit_price_cents',
        'cogs_cents',
        'line_total_cents',
        'fulfilment',
        'digital_resolution',
        'download_token',
        'download_count',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'unit_price_cents' => 'integer',
            'cogs_cents' => 'integer',
            'line_total_cents' => 'integer',
            'download_count' => 'integer',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function photo(): BelongsTo
    {
        return $this->belongsTo(Photo::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function option(): BelongsTo
    {
        return $this->belongsTo(ProductOption::class, 'option_id');
    }
}
