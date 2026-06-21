<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'code',
        'type',
        'value',
        'currency',
        'min_subtotal_cents',
        'max_redemptions',
        'redeemed_count',
        'active',
        'show_banner',
        'banner_text',
        'starts_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'integer',
            'min_subtotal_cents' => 'integer',
            'max_redemptions' => 'integer',
            'redeemed_count' => 'integer',
            'active' => 'boolean',
            'show_banner' => 'boolean',
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    /** Whether the coupon may currently be redeemed for the given subtotal. */
    public function isRedeemable(int $subtotalCents): bool
    {
        if (! $this->active) {
            return false;
        }
        if ($this->starts_at && $this->starts_at->isFuture()) {
            return false;
        }
        if ($this->expires_at && $this->expires_at->isPast()) {
            return false;
        }
        if ($this->max_redemptions !== null && $this->redeemed_count >= $this->max_redemptions) {
            return false;
        }
        if ($this->min_subtotal_cents !== null && $subtotalCents < $this->min_subtotal_cents) {
            return false;
        }

        return true;
    }

    public function freeShipping(): bool
    {
        return $this->type === 'free_shipping';
    }
}
