<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

class AdminAuditLog extends Model
{
    protected $fillable = [
        'user_id',
        'action',
        'target_type',
        'target_id',
        'description',
        'meta',
        'ip',
    ];

    protected function casts(): array
    {
        return ['meta' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Record an admin action. The actor defaults to the current user (the real
     * admin, even mid-impersonation, since this is called from the admin flow).
     *
     * @param  array<string, mixed>  $meta
     */
    public static function record(string $action, ?Model $target = null, ?string $description = null, array $meta = [], ?int $actorId = null): self
    {
        return static::create([
            'user_id' => $actorId ?? Auth::id(),
            'action' => $action,
            'target_type' => $target ? $target::class : null,
            'target_id' => $target?->getKey(),
            'description' => $description,
            'meta' => $meta ?: null,
            'ip' => Request::ip(),
        ]);
    }
}
