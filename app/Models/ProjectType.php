<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProjectType extends Model
{
    use BelongsToStudio, HasFactory;

    /** Seeded for each studio on first use: label => hex colour. */
    public const DEFAULTS = [
        ['Wedding', '#f43f5e'],
        ['Couples Shoot', '#ec4899'],
        ['Corporate', '#3b82f6'],
        ['Portrait', '#a855f7'],
        ['Event', '#f59e0b'],
        ['Other', '#6b7280'],
    ];

    protected $fillable = ['studio_id', 'label', 'color', 'position'];

    protected function casts(): array
    {
        return ['position' => 'integer'];
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class, 'type_id');
    }

    public static function seedDefaults(): void
    {
        foreach (self::DEFAULTS as $i => [$label, $color]) {
            static::create(['label' => $label, 'color' => $color, 'position' => $i]);
        }
    }
}
