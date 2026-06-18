<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class PackageBooking extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'package_id',
        'contact_id',
        'project_id',
        'public_id',
        'client_name',
        'client_email',
        'client_phone',
        'notes',
        'amount_cents',
        'payment_type',
        'currency',
        'status',
        'stripe_session_id',
        'stripe_payment_intent',
    ];

    protected function casts(): array
    {
        return [
            'amount_cents' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (PackageBooking $booking) {
            if (empty($booking->public_id)) {
                $booking->public_id = (string) Str::uuid();
            }
        });
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(Package::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
