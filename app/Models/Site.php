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
        'custom_domain',
        'domain_token',
        'domain_verified_at',
        'domain_provisioned_at',
        'template',
        'theme',
        'header_nav',
        'footer_nav',
        'head_code',
        'body_code',
        'cookie_consent',
        'cookie_message',
        'cookie_policy_url',
        'contact_email',
        'seo_title',
        'seo_description',
        'favicon_url',
        'og_image_url',
        'redirects',
        'saved_sections',
        'is_published',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'theme' => 'array',
            'header_nav' => 'array',
            'footer_nav' => 'array',
            'redirects' => 'array',
            'saved_sections' => 'array',
            'is_published' => 'boolean',
            'cookie_consent' => 'boolean',
            'published_at' => 'datetime',
            'domain_verified_at' => 'datetime',
            'domain_provisioned_at' => 'datetime',
        ];
    }

    /** Normalize user input to a bare hostname (lowercase, no scheme/path/www). */
    public static function normalizeDomain(string $domain): string
    {
        $domain = strtolower(trim($domain));
        $domain = preg_replace('#^https?://#', '', $domain);   // strip scheme
        $domain = explode('/', $domain)[0];                    // strip path
        $domain = preg_replace('#^www\.#', '', (string) $domain); // canonicalise apex

        return trim((string) $domain);
    }

    public function domainVerified(): bool
    {
        return $this->custom_domain && $this->domain_verified_at !== null;
    }

    /** Verified AND provisioned (nginx vhost + TLS) — safe to serve/link over HTTPS. */
    public function domainLive(): bool
    {
        return $this->domainVerified() && $this->domain_provisioned_at !== null;
    }

    /** Theme with sensible fallbacks so the renderer never sees missing keys. */
    public function themeSettings(): array
    {
        $t = $this->theme ?? [];

        $font = $t['font'] ?? 'sans';

        return [
            'primary_color' => $t['primary_color'] ?? '#171717',
            'font' => $font,
            'heading_font' => $t['heading_font'] ?? $font,
            'body_font' => $t['body_font'] ?? $font,
            'logo_font' => $t['logo_font'] ?? '',
            'logo_color' => $t['logo_color'] ?? '',
            'nav_color' => $t['nav_color'] ?? '',
            'nav_size' => $t['nav_size'] ?? 'sm',
            'logo_size' => $t['logo_size'] ?? 'sm',
            'style' => $t['style'] ?? 'classic',
            'width' => $t['width'] ?? 'normal',
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
