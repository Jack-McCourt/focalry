<?php

namespace App\Http\Controllers\StudioManager\Concerns;

use App\Models\Site;
use App\Models\Studio;
use App\Support\SiteTemplates;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Resolves the current studio's website (seeding a starter site on first
 * visit). Shared by every website-builder controller (site, domain, media,
 * categories) so they all agree on how "the site" comes into being.
 */
trait ResolvesSite
{
    /** Get the studio's site, seeding a starter site the first time. */
    private function resolveSite(): Site
    {
        $studio = Studio::findOrFail(app('current.studio.id'));

        $site = Site::where('studio_id', $studio->id)->first();
        if ($site) {
            return $site->load('pages');
        }

        return DB::transaction(function () use ($studio) {
            $site = Site::create([
                'studio_id' => $studio->id,
                'name' => $studio->name ?: 'My Studio',
                'slug' => $this->uniqueSiteSlug($studio->slug ?: $studio->name ?: 'studio'),
                'template' => SiteTemplates::DEFAULT,
                'theme' => SiteTemplates::theme(SiteTemplates::DEFAULT),
                'header_nav' => SiteTemplates::headerNav(SiteTemplates::DEFAULT),
                'footer_nav' => SiteTemplates::footerNav(SiteTemplates::DEFAULT),
                'contact_email' => $studio->email,
                'is_published' => false,
            ]);

            $this->seedPages($site, SiteTemplates::DEFAULT, $studio->name ?: 'My Studio');

            return $site->load('pages');
        });
    }

    /** Seed a template's starter pages (+ example blog posts) onto a site. */
    private function seedPages(Site $site, string $template, string $studioName): void
    {
        $blogPageId = null;

        foreach (SiteTemplates::pages($template, $studioName) as $i => $page) {
            $created = $site->pages()->create([
                'studio_id' => $site->studio_id,
                'title' => $page['title'],
                'slug' => $page['slug'],
                'is_home' => $page['is_home'] ?? false,
                'is_blog' => $page['is_blog'] ?? false,
                'position' => $i,
                'blocks' => $page['blocks'],
            ]);

            if ($created->is_blog) {
                $blogPageId = $created->id;
            }
        }

        // Seed example posts as child pages of the blog page.
        if ($blogPageId) {
            foreach (SiteTemplates::posts($template) as $i => $post) {
                $site->pages()->create([
                    'studio_id' => $site->studio_id,
                    'parent_id' => $blogPageId,
                    'title' => $post['title'],
                    'slug' => $post['slug'],
                    'position' => $i,
                    'blocks' => $post['blocks'],
                    'status' => $post['status'] ?? 'published',
                    'published_at' => isset($post['days_ago']) ? now()->subDays($post['days_ago']) : now(),
                    'excerpt' => $post['excerpt'] ?? null,
                    'cover_image' => $post['cover_image'] ?? null,
                ]);
            }
        }
    }

    /** A site slug not taken by any other studio's site. */
    private function uniqueSiteSlug(string $base): string
    {
        $slug = Str::slug($base) ?: 'studio';
        $candidate = $slug;
        $n = 1;
        while (Site::where('slug', $candidate)->exists()) {
            $candidate = $slug.'-'.(++$n);
        }

        return $candidate;
    }
}
