<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A WordPress-style blog category: hierarchical (a category can have a parent),
 * scoped to a single site. Posts reference categories by id via
 * SitePage::$category_ids.
 */
class SiteCategory extends Model
{
    use BelongsToStudio, HasFactory;

    /** Category changes bump the site's updated_at → busts the public-page cache. */
    protected $touches = ['site'];

    protected $fillable = [
        'studio_id',
        'site_id',
        'parent_id',
        'name',
        'slug',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'parent_id' => 'integer',
            'position' => 'integer',
        ];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }
}
