<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class MeetingType extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'name',
        'slug',
        'description',
        'duration_minutes',
        'location_type',
        'location',
        'video_provider',
        'color',
        'buffer_minutes',
        'min_lead_hours',
        'max_per_day',
        'manual_approve',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'duration_minutes' => 'integer',
            'buffer_minutes' => 'integer',
            'min_lead_hours' => 'integer',
            'max_per_day' => 'integer',
            'manual_approve' => 'boolean',
            'active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        // Runs after BelongsToStudio's creating hook fills studio_id.
        static::creating(function (MeetingType $type) {
            if (empty($type->slug)) {
                $studioId = $type->studio_id ?? app('current.studio.id');
                $type->slug = static::uniqueSlug((int) $studioId, $type->name);
            }
        });
    }

    /** Build a slug unique within the studio. */
    public static function uniqueSlug(int $studioId, string $name): string
    {
        $base = Str::slug($name) ?: 'meeting';
        $slug = $base;
        $i = 2;
        while (static::withoutGlobalScopes()->where('studio_id', $studioId)->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }

    public function meetings(): HasMany
    {
        return $this->hasMany(Meeting::class);
    }
}
