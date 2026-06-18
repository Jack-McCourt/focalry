<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Site extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'name',
        'slug',
        'template',
        'theme',
        'header_nav',
        'footer_nav',
        'contact_email',
        'seo_title',
        'seo_description',
        'is_published',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'theme' => 'array',
            'header_nav' => 'array',
            'footer_nav' => 'array',
            'is_published' => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    /** Theme with sensible fallbacks so the renderer never sees missing keys. */
    public function themeSettings(): array
    {
        $t = $this->theme ?? [];

        return [
            'primary_color' => $t['primary_color'] ?? '#171717',
            'font' => $t['font'] ?? 'sans',
        ];
    }

    /** All pages including blog posts (which are child pages). */
    public function pages(): HasMany
    {
        return $this->hasMany(SitePage::class)->orderBy('position');
    }

    /** Top-level pages only (excludes blog posts). */
    public function topPages(): HasMany
    {
        return $this->hasMany(SitePage::class)->whereNull('parent_id')->orderBy('position');
    }

    /** The page designated as the blog index, if any. */
    public function blogPage(): ?SitePage
    {
        return $this->pages->firstWhere('is_blog', true);
    }

    public function leads(): HasMany
    {
        return $this->hasMany(SiteLead::class);
    }

    public function homePage(): ?SitePage
    {
        return $this->pages->firstWhere('is_home', true) ?? $this->pages->first();
    }
}
