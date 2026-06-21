<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Proposal extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'project_id',
        'contact_id',
        'package_id',
        'contract_id',
        'invoice_id',
        'title',
        'status',
        'intro',
        'require_signature',
        'require_deposit',
        'sent_at',
        'accepted_at',
        'declined_at',
    ];

    protected function casts(): array
    {
        return [
            'require_signature' => 'boolean',
            'require_deposit' => 'boolean',
            'sent_at' => 'datetime',
            'accepted_at' => 'datetime',
            'declined_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Proposal $p) {
            if (empty($p->public_id)) {
                $p->public_id = (string) Str::uuid();
            }
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(Package::class);
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /**
     * Whether every required step has been satisfied — used to flip the proposal
     * to "accepted" after a client signs and/or pays.
     */
    public function isFullyAccepted(): bool
    {
        $signatureOk = ! $this->require_signature
            || ($this->contract && $this->contract->status === 'signed');

        $depositOk = ! $this->require_deposit
            || ($this->invoice && (int) $this->invoice->amount_paid_cents > 0);

        return $signatureOk && $depositOk;
    }
}
