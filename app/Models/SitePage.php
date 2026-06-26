<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SitePage extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'site_id',
        'parent_id',
        'title',
        'slug',
        'position',
        'is_home',
        'is_blog',
        'is_404',
        'blocks',
        'status',
        'published_at',
        'excerpt',
        'category',
        'category_ids',
        'hidden_category_ids',
        'cover_image',
        'seo_title',
        'seo_description',
        'head_code',
        'body_code',
        'og_image',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'is_home' => 'boolean',
            'is_blog' => 'boolean',
            'is_404' => 'boolean',
            'blocks' => 'array',
            'category_ids' => 'array',
            'hidden_category_ids' => 'array',
            'published_at' => 'datetime',
        ];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    /** The blog page this post belongs to (null for top-level pages). */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(SitePage::class, 'parent_id');
    }

    /** Child pages — i.e. the blog posts under a blog page. */
    public function posts(): HasMany
    {
        return $this->hasMany(SitePage::class, 'parent_id')->orderByDesc('published_at')->orderByDesc('id');
    }

    public function isPost(): bool
    {
        return $this->parent_id !== null;
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published')
            ->where(fn ($q) => $q->whereNull('published_at')->orWhere('published_at', '<=', now()));
    }
}
