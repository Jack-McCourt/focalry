<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CreditLedgerEntry extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'gift_card_id',
        'order_id',
        'delta_cents',
        'balance_after_cents',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'delta_cents' => 'integer',
            'balance_after_cents' => 'integer',
        ];
    }

    public function giftCard(): BelongsTo
    {
        return $this->belongsTo(GiftCard::class);
    }
}
