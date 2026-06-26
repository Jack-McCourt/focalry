<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A per-recipient invitation to view a project's read-only share page. The
 * unguessable token is emailed to the invitee; access is revoked by deleting
 * the row. Restricted, Google-Drive style — not a public link.
 */
class ProjectShare extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = ['studio_id', 'project_id', 'email', 'token', 'code', 'last_viewed_at'];

    protected function casts(): array
    {
        return ['last_viewed_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::creating(function (ProjectShare $share) {
            if (empty($share->token)) {
                $share->token = Str::random(48);
            }
            if (empty($share->code)) {
                $share->code = (string) random_int(100000, 999999);
            }
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function url(): string
    {
        return route('projects.public.show', $this->token);
    }

    /** A persistent, reusable access code (not one-time). */
    public function checkCode(string $code): bool
    {
        return $this->code !== null && hash_equals($this->code, trim($code));
    }
}
