<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GiftCard extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'code',
        'initial_cents',
        'balance_cents',
        'currency',
        'recipient_email',
        'note',
        'active',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'initial_cents' => 'integer',
            'balance_cents' => 'integer',
            'active' => 'boolean',
            'expires_at' => 'datetime',
        ];
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(CreditLedgerEntry::class);
    }

    public function isUsable(): bool
    {
        return $this->active
            && $this->balance_cents > 0
            && ! ($this->expires_at && $this->expires_at->isPast());
    }
}
