<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class Conversation extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'contact_id',
        'subject',
        'reply_token',
        'status',
        'tags',
        'unread',
        'last_message_at',
    ];

    protected function casts(): array
    {
        return [
            'unread' => 'boolean',
            'tags' => 'array',
            'last_message_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Conversation $conversation) {
            if (empty($conversation->reply_token)) {
                $conversation->reply_token = Str::lower(Str::random(32));
            }
        });
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('id');
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    /** Reply-To address that routes a client's reply back to this conversation. */
    public function replyToAddress(): ?string
    {
        $base = config('services.messaging.inbound_address');
        if (! $base || ! str_contains($base, '@')) {
            return null;
        }
        [$local, $domain] = explode('@', $base, 2);

        return "{$local}+{$this->reply_token}@{$domain}";
    }

    /** Stable References id so the client's email app threads the conversation. */
    public function threadReference(): string
    {
        $host = parse_url((string) config('app.url'), PHP_URL_HOST) ?: 'localhost';

        return "conv-{$this->reply_token}@{$host}";
    }
}
