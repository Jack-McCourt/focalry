<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProjectStatus extends Model
{
    use BelongsToStudio, HasFactory;

    /** Seeded for each studio on first use: label => hex colour. */
    public const DEFAULTS = [
        ['Lead', '#94a3b8'],
        ['Enquiry', '#38bdf8'],
        ['Booked', '#818cf8'],
        ['In progress', '#fbbf24'],
        ['Editing', '#f472b6'],
        ['Delivered', '#34d399'],
        ['Completed', '#22c55e'],
    ];

    protected $fillable = ['studio_id', 'label', 'color', 'position'];

    protected function casts(): array
    {
        return ['position' => 'integer'];
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class, 'status_id');
    }

    public static function seedDefaults(): void
    {
        foreach (self::DEFAULTS as $i => [$label, $color]) {
            static::create(['label' => $label, 'color' => $color, 'position' => $i]);
        }
    }
}
