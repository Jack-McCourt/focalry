<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use App\Support\PublicAsset;
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
        'logo_path',
        'footer_logo_path',
        'header_nav',
        'footer_nav',
        'announcement',
        'social',
        'footer',
        'custom_fonts',
        'coming_soon',
        'preview_token',
        'head_code',
        'body_code',
        'custom_css',
        'cookie_consent',
        'cookie_message',
        'cookie_policy_url',
        'instagram_username',
        'instagram_token',
        'instagram_token_expires_at',
        'turnstile_site_key',
        'turnstile_secret_key',
        'contact_email',
        'auto_create_project',
        'seo_title',
        'seo_description',
        'favicon_url',
        'og_image_url',
        'redirects',
        'saved_sections',
        'draft',
        'draft_saved_at',
        'is_published',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'theme' => 'array',
            'header_nav' => 'array',
            'footer_nav' => 'array',
            'announcement' => 'array',
            'social' => 'array',
            'footer' => 'array',
            'custom_fonts' => 'array',
            'coming_soon' => 'boolean',
            'redirects' => 'array',
            'saved_sections' => 'array',
            'draft' => 'array',
            'draft_saved_at' => 'datetime',
            'is_published' => 'boolean',
            'cookie_consent' => 'boolean',
            'auto_create_project' => 'boolean',
            'published_at' => 'datetime',
            'domain_verified_at' => 'datetime',
            'instagram_token' => 'encrypted',
            'turnstile_secret_key' => 'encrypted',
            'instagram_token_expires_at' => 'datetime',
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

    /** Public URL for the site — the custom domain when it's live, else the slug route. */
    public function publicUrl(): string
    {
        if ($this->domainLive()) {
            return 'https://'.$this->custom_domain;
        }

        return route('sites.public.show', $this->slug);
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
            'heading_weight' => $t['heading_weight'] ?? null,
            'body_weight' => $t['body_weight'] ?? null,
            'logo_font' => $t['logo_font'] ?? '',
            'logo_color' => $t['logo_color'] ?? '',
            'nav_color' => $t['nav_color'] ?? '',
            'text_color' => $t['text_color'] ?? '',
            'nav_size' => $t['nav_size'] ?? 'sm',
            'logo_size' => $t['logo_size'] ?? 'sm',
            // Size of an uploaded header logo IMAGE (small | medium | large).
            // Distinct from logo_size above, which sizes the text wordmark.
            'header_logo_size' => $t['header_logo_size'] ?? 'medium',
            'style' => $t['style'] ?? 'classic',
            'header_style' => $t['header_style'] ?? 'solid',
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

    /** The website's own logo, if one has been uploaded. */
    public function logoUrl(): ?string
    {
        return PublicAsset::url($this->logo_path);
    }

    /** The website's footer logo, if one has been uploaded (separate from the header). */
    public function footerLogoUrl(): ?string
    {
        return PublicAsset::url($this->footer_logo_path);
    }

    /**
     * The logo to show in the site header: the website's own uploaded logo, or
     * null to fall back to the text wordmark. No studio-logo fallback — the
     * studio logo is for invoices/emails, not the public site header.
     */
    public function headerLogoUrl(): ?string
    {
        return $this->logoUrl();
    }

    /**
     * The Turnstile key pair to use: the studio's own (when both halves are
     * set — mixing halves across accounts always fails verification),
     * otherwise the platform-level env keys.
     *
     * @return array{site: ?string, secret: ?string}
     */
    public function turnstileKeys(): array
    {
        if ($this->turnstile_site_key && $this->turnstile_secret_key) {
            return ['site' => $this->turnstile_site_key, 'secret' => $this->turnstile_secret_key];
        }

        return [
            'site' => config('services.turnstile.site_key'),
            'secret' => config('services.turnstile.secret_key'),
        ];
    }

    /** Published-version history (restorable into the draft). */
    public function snapshots(): HasMany
    {
        return $this->hasMany(SiteSnapshot::class)->latest();
    }

    /** Newsletter signups from the site's newsletter block. */
    public function subscribers(): HasMany
    {
        return $this->hasMany(SiteSubscriber::class);
    }

    /** Blog categories for this site (hierarchical; ordered for display). */
    public function categories(): HasMany
    {
        return $this->hasMany(SiteCategory::class)->orderBy('position')->orderBy('name');
    }

    public function homePage(): ?SitePage
    {
        return $this->pages->firstWhere('is_home', true) ?? $this->pages->first();
    }
}
