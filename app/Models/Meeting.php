<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Meeting extends Model
{
    use BelongsToStudio, HasFactory;

    /** Statuses that occupy a slot (block availability). */
    public const ACTIVE_STATUSES = ['pending', 'confirmed'];

    protected $fillable = [
        'studio_id',
        'meeting_type_id',
        'contact_id',
        'public_id',
        'client_name',
        'client_email',
        'client_phone',
        'starts_at',
        'ends_at',
        'status',
        'price_cents',
        'currency',
        'location',
        'notes',
        'meeting_url',
        'google_event_id',
        'reminders_sent',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'price_cents' => 'integer',
            'reminders_sent' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Meeting $meeting) {
            if (empty($meeting->public_id)) {
                $meeting->public_id = (string) Str::uuid();
            }
        });
    }

    public function meetingType(): BelongsTo
    {
        return $this->belongsTo(MeetingType::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }
}
