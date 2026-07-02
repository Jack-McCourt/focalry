<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A single, passwordless entry point to a client's portal — one per contact.
 * The unguessable token lives in the emailed link; opening it still requires a
 * persistent 6-digit code sent to the contact's address, so a forwarded link
 * alone can't expose the client's documents. Mirrors {@see ProjectShare}.
 */
class ClientPortalAccess extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = ['studio_id', 'contact_id', 'token', 'code', 'last_viewed_at'];

    protected function casts(): array
    {
        return ['last_viewed_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::creating(function (ClientPortalAccess $access) {
            if (empty($access->token)) {
                $access->token = Str::random(48);
            }
            if (empty($access->code)) {
                $access->code = (string) random_int(100000, 999999);
            }
        });
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function url(): string
    {
        return route('portal.show', $this->token);
    }

    /** A persistent, reusable access code (not one-time). */
    public function checkCode(string $code): bool
    {
        return $this->code !== null && hash_equals($this->code, trim($code));
    }
}
