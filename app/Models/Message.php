<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Message extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'conversation_id',
        'direction',
        'is_internal',
        'user_id',
        'author_name',
        'author_email',
        'body',
        'email_message_id',
        'status',
        'opened_at',
        'error',
    ];

    protected function casts(): array
    {
        return [
            'is_internal' => 'boolean',
            'opened_at' => 'datetime',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /** Signed open-tracking pixel URL for outbound email read receipts. */
    public function openTrackingUrl(): string
    {
        return route('mail.open', ['message' => $this->id, 'token' => $this->openToken()]);
    }

    public function openToken(): string
    {
        return hash_hmac('sha256', 'open:'.$this->id, (string) config('app.key'));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(MessageAttachment::class);
    }
}
