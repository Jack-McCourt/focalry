<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Jobs\ImportSiteImage;
use App\Models\Collection;
use App\Models\GalleryRecentPick;
use App\Models\Photo;
use App\Models\Site;
use App\Models\SiteCategory;
use App\Models\SitePage;
use App\Models\SiteVisit;
use App\Models\Studio;
use App\Support\GooglePlaces;
use App\Support\Images;
use App\Support\PublicAsset;
use App\Support\SiteTemplates;
use App\Support\StudioPaths;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SiteController extends Controller
{
    /** The website builder. Creates a starter site on first visit. */
    public function edit(): Response
    {
        $site = $this->resolveSite();

        return Inertia::render('Website/Builder', [
            'site' => $this->serialize($site),
            'templates' => SiteTemplates::all(),
            'public_url' => route('sites.public.show', $site->slug),
            'leads_count' => $site->leads()->count(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $site = $this->resolveSite();
        $data = $this->validateSite($request, $site);

        DB::transaction(function () use ($site, $data) {
            $this->applySiteSettings($site, $data);
            $site->update(['saved_sections' => array_values($data['saved_sections'] ?? [])]);
            $this->syncPages($site, $data['pages'] ?? []);
        });

        return back()->with('success', 'Website saved.');
    }

    /** The site settings page (separate from the builder). */
    public function settings(): Response
    {
        $site = $this->resolveSite();

        return Inertia::render('Website/Settings', [
            'site' => $this->serialize($site),
            'templates' => SiteTemplates::all(),
            'public_url' => route('sites.public.show', $site->slug),
            'domain_config' => config('services.custom_domains'),
            'studio_logo' => $site->studio?->logoUrl(),
        ]);
    }

    /** Save just the site-wide settings (no pages) from the settings page. */
    public function updateSettings(Request $request): RedirectResponse
    {
        $site = $this->resolveSite();
        $data = $request->validate($this->siteRules($site));

        $this->applySiteSettings($site, $data);

        return back()->with('success', 'Settings saved.');
    }

    /** Set (or change) the site's custom domain — resets verification. */
    public function updateDomain(Request $request): RedirectResponse
    {
        $site = $this->resolveSite();
        $data = $request->validate([
            'custom_domain' => ['required', 'string', 'max:255', 'regex:/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i'],
        ]);

        $domain = Site::normalizeDomain($data['custom_domain']);

        // Don't let a studio claim the platform's own domain.
        $appHost = Site::normalizeDomain((string) parse_url((string) config('app.url'), PHP_URL_HOST));
        if ($domain === $appHost) {
            return back()->withErrors(['custom_domain' => 'That domain isn’t available.']);
        }

        $taken = Site::withoutGlobalScopes()
            ->where('custom_domain', $domain)
            ->where('id', '!=', $site->id)
            ->exists();
        if ($taken) {
            return back()->withErrors(['custom_domain' => 'That domain is already connected to another site.']);
        }

        $site->update([
            'custom_domain' => $domain,
            'domain_token' => 'focalry-verify='.Str::random(32),
            'domain_verified_at' => null,
            'domain_provisioned_at' => null,
        ]);

        return back()->with('success', 'Domain saved. Add the DNS records below, then verify.');
    }

    /** Verify ownership by looking up the DNS TXT token. */
    public function verifyDomain(): RedirectResponse
    {
        $site = $this->resolveSite();
        if (! $site->custom_domain || ! $site->domain_token) {
            return back()->withErrors(['custom_domain' => 'Add a domain first.']);
        }

        $records = @dns_get_record('_focalry-verify.'.$site->custom_domain, DNS_TXT) ?: [];
        $found = collect($records)->contains(fn ($r) => trim($r['txt'] ?? '') === $site->domain_token);

        if (! $found) {
            return back()->withErrors(['custom_domain' => 'Verification TXT record not found yet. DNS can take a few minutes to propagate.']);
        }

        $site->update(['domain_verified_at' => now()]);

        return back()->with('success', 'Domain verified. It will go live once the certificate is issued (usually within a few minutes).');
    }

    /** Disconnect the custom domain. */
    public function removeDomain(): RedirectResponse
    {
        $site = $this->resolveSite();
        $site->update([
            'custom_domain' => null,
            'domain_token' => null,
            'domain_verified_at' => null,
            'domain_provisioned_at' => null,
        ]);

        return back()->with('success', 'Custom domain disconnected.');
    }

    /** Write the site-wide settings fields (everything except pages/sections). */
    private function applySiteSettings(Site $site, array $data): void
    {
        $site->update([
            'name' => $data['name'],
            'slug' => $data['slug'],
            'contact_email' => $data['contact_email'] ?? null,
            'auto_create_project' => $data['auto_create_project'] ?? true,
            'seo_title' => $data['seo_title'] ?? null,
            'seo_description' => $data['seo_description'] ?? null,
            'favicon_url' => $data['favicon_url'] ?? null,
            'og_image_url' => $data['og_image_url'] ?? null,
            'redirects' => $this->cleanRedirects($data['redirects'] ?? []),
            'theme' => [
                'primary_color' => $data['theme']['primary_color'] ?? '#171717',
                'font' => $data['theme']['font'] ?? 'sans',
                'heading_font' => $data['theme']['heading_font'] ?? ($data['theme']['font'] ?? 'sans'),
                'body_font' => $data['theme']['body_font'] ?? ($data['theme']['font'] ?? 'sans'),
                'logo_font' => $data['theme']['logo_font'] ?? '',
                'logo_color' => $data['theme']['logo_color'] ?? '',
                'nav_color' => $data['theme']['nav_color'] ?? '',
                'nav_size' => $data['theme']['nav_size'] ?? ($site->theme['nav_size'] ?? 'sm'),
                'logo_size' => $data['theme']['logo_size'] ?? ($site->theme['logo_size'] ?? 'sm'),
                'style' => $data['theme']['style'] ?? ($site->theme['style'] ?? 'classic'),
                'width' => $data['theme']['width'] ?? ($site->theme['width'] ?? 'normal'),
            ],
            'header_nav' => $this->cleanNav($data['header_nav'] ?? []),
            'footer_nav' => $this->cleanNav($data['footer_nav'] ?? []),
            'head_code' => $data['head_code'] ?? null,
            'body_code' => $data['body_code'] ?? null,
            'cookie_consent' => $data['cookie_consent'] ?? false,
            'cookie_message' => $data['cookie_message'] ?? null,
            'cookie_policy_url' => $data['cookie_policy_url'] ?? null,
        ]);
    }

    public function publish(Request $request): RedirectResponse
    {
        $site = $this->resolveSite();
        $publish = $request->boolean('publish');

        $site->update([
            'is_published' => $publish,
            'published_at' => $publish ? ($site->published_at ?? now()) : $site->published_at,
        ]);

        return back()->with('success', $publish ? 'Website published.' : 'Website unpublished.');
    }

    /** Replace the site's pages from a starter template (destructive). */
    public function applyTemplate(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'template' => ['required', 'string', Rule::in(array_keys(SiteTemplates::META))],
            'replace' => ['boolean'],
        ]);

        $site = $this->resolveSite();
        $template = $validated['template'];

        // Default: restyle only — apply the template's colours/fonts and keep all
        // the studio's pages, content and menus so switching loses no progress.
        if (! $request->boolean('replace')) {
            $site->update([
                'template' => $template,
                'theme' => SiteTemplates::theme($template),
            ]);

            return back()->with('success', 'Template style applied — your content was kept.');
        }

        // Opt-in: replace everything with the template's sample pages (fresh start).
        $studio = Studio::find($site->studio_id);

        DB::transaction(function () use ($site, $studio, $template) {
            $site->update([
                'template' => $template,
                'theme' => SiteTemplates::theme($template),
                'header_nav' => SiteTemplates::headerNav($template),
                'footer_nav' => SiteTemplates::footerNav($template),
            ]);
            $site->pages()->delete();
            $this->seedPages($site, $template, $studio?->name ?? $site->name);
        });

        return back()->with('success', 'Template applied.');
    }

    /**
     * Async image upload for block image fields. Converts to size-capped WebP
     * for fast delivery (animated GIFs are kept as-is). Returns JSON {url, path}.
     */
    public function uploadImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'required|image|mimes:png,jpg,jpeg,webp,gif|max:8192',
        ]);

        $studioId = app('current.studio.id');
        $file = $request->file('image');
        $disk = Storage::disk('wasabi');

        // Everything lives in Wasabi (stateless — no local disk). Site images are
        // public assets on the live site, so they're stored public-read and served
        // via the bucket/CDN's permanent URL.
        if ($file->getClientOriginalExtension() === 'gif') {
            // Keep animated GIFs untouched.
            $path = StudioPaths::asset($studioId, 'site/'.Str::uuid().'.gif');
            $disk->put($path, file_get_contents($file->getRealPath()), 'public');
        } else {
            $path = StudioPaths::asset($studioId, 'site/'.Str::uuid().'.webp');
            try {
                // Cap at 1920px wide (Full HD) — large enough for full-bleed hero
                // banners (a 16:9 source becomes 1920×1080) without shipping huge files.
                $disk->put($path, Images::webp($file->getRealPath(), 1920), 'public');
            } catch (\Throwable $e) {
                report($e);
                $path = StudioPaths::asset($studioId, 'site/'.Str::uuid().'.'.$file->getClientOriginalExtension());
                $disk->put($path, file_get_contents($file->getRealPath()), 'public');
            }
        }

        return response()->json([
            'url' => PublicAsset::url($path),
            'path' => $path,
        ]);
    }

    /** Collections + their ready photos (signed thumbnails) for the gallery picker. */
    public function galleryImages(): JsonResponse
    {
        $collections = Collection::with(['photos' => fn ($q) => $q->where('status', 'ready')->orderBy('position')])
            ->orderByDesc('event_date')
            ->orderBy('title')
            ->get(['id', 'title', 'event_date']);

        return response()->json([
            'recent' => $this->recentlyUsedPhotos(),
            'collections' => $collections->map(fn (Collection $c) => [
                'id' => $c->id,
                'title' => $c->title,
                'photos' => $c->photos
                    ->map(fn (Photo $p) => $this->pickerPhoto($p))
                    ->filter(fn ($p) => $p['thumb'])
                    ->values(),
            ])->filter(fn ($c) => count($c['photos']) > 0)->values(),
        ]);
    }

    /** The studio's most-recently-used gallery photos, newest first. */
    private function recentlyUsedPhotos(int $limit = 40): array
    {
        $ids = GalleryRecentPick::orderByDesc('used_at')->limit($limit)->pluck('photo_id');
        if ($ids->isEmpty()) {
            return [];
        }

        $photos = Photo::whereIn('id', $ids)->where('status', 'ready')->get()->keyBy('id');

        // Preserve the recency order (whereIn doesn't), and drop any since deleted.
        return $ids
            ->map(fn ($id) => $photos->get($id))
            ->filter()
            ->map(fn (Photo $p) => $this->pickerPhoto($p))
            ->filter(fn ($p) => $p['thumb'])
            ->values()
            ->all();
    }

    /** @return array{id: int, thumb: string|null} */
    private function pickerPhoto(Photo $p): array
    {
        return ['id' => $p->id, 'thumb' => $p->firstSignedUrl(['thumb', 'web'], 180)];
    }

    /**
     * Import chosen gallery photos into the site. Gallery URLs are signed/short-
     * lived, so a permanent public copy is made — but resizing a full-size
     * original is slow, so the conversion is queued (ImportSiteImage) and the
     * permanent URLs are returned instantly; the images fill in when the worker
     * finishes, just like main gallery uploads. Returns JSON {urls}.
     */
    public function importGalleryImages(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'photo_ids' => 'required|array|max:60',
            'photo_ids.*' => 'integer',
        ]);

        $studioId = app('current.studio.id');
        $urls = [];

        foreach ($validated['photo_ids'] as $id) {
            // Studio-scoped via the global scope, so cross-tenant ids are ignored.
            $photo = Photo::find($id);
            // Prefer the original so site/hero images can be Full HD (1920px); the
            // 1200px web derivative is only a fallback when there's no original.
            $key = $photo?->wasabi_key_original
                ?: ($photo?->derivativeKey('web') ?? $photo?->derivativeKey('preview') ?? $photo?->derivativeKey('thumb'));
            if (! $key) {
                continue;
            }

            // Queue the (slow) original→1920 WebP conversion to Wasabi; the public
            // URL is live the moment the worker writes the object.
            $dest = StudioPaths::asset($studioId, "site/gallery/{$photo->id}-".Str::random(6).'.webp');
            ImportSiteImage::dispatch($key, $dest, 1920);
            $urls[] = PublicAsset::url($dest);

            // Track for the picker's "Recently used" tab.
            GalleryRecentPick::touchPhoto($photo->id);
        }

        return response()->json(['urls' => $urls]);
    }

    /** Search Google for a business so the user can pick their listing. */
    public function googleReviewsSearch(Request $request, GooglePlaces $places): JsonResponse
    {
        $validated = $request->validate([
            'query' => 'required|string|max:255',
        ]);

        if (! GooglePlaces::configured()) {
            return response()->json(['message' => 'Google reviews are not set up on this platform yet.'], 422);
        }

        try {
            return response()->json(['results' => $places->searchText($validated['query'])]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /** Pull a place's summary + reviews from Google for the reviews block. */
    public function googleReviews(Request $request, GooglePlaces $places): JsonResponse
    {
        $validated = $request->validate([
            'place_id' => 'required|string|max:255',
        ]);

        if (! GooglePlaces::configured()) {
            return response()->json(['message' => 'Google reviews are not set up on this platform yet.'], 422);
        }

        try {
            return response()->json($places->placeDetails($validated['place_id']));
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /** Built-in traffic analytics for the last 30 days. */
    public function analytics(): Response
    {
        $site = $this->resolveSite();
        $days = 30;
        $since = now()->subDays($days - 1)->startOfDay();

        $base = SiteVisit::where('site_id', $site->id)->where('created_at', '>=', $since);

        $perDay = (clone $base)
            ->selectRaw('DATE(created_at) as d, COUNT(*) as c')
            ->groupBy('d')->pluck('c', 'd');

        // Fill a continuous daily series so the chart has no gaps.
        $series = collect(range(0, $days - 1))->map(function ($i) use ($since, $perDay) {
            $date = $since->copy()->addDays($i)->toDateString();

            return ['date' => $date, 'views' => (int) ($perDay[$date] ?? 0)];
        })->values();

        $totalViews = (int) $perDay->sum();
        $leads = $site->leads()->where('created_at', '>=', $since)->count();

        return Inertia::render('Website/Analytics', [
            'public_url' => route('sites.public.show', $site->slug),
            'is_published' => $site->is_published,
            'range_days' => $days,
            'series' => $series,
            'total_views' => $totalViews,
            'total_leads' => $leads,
            'conversion' => $totalViews > 0 ? round($leads / $totalViews * 100, 1) : 0,
            'top_pages' => (clone $base)->selectRaw('path, COUNT(*) as c')->groupBy('path')->orderByDesc('c')->limit(8)->get(),
            'top_referrers' => (clone $base)->whereNotNull('referrer_host')->selectRaw('referrer_host, COUNT(*) as c')->groupBy('referrer_host')->orderByDesc('c')->limit(8)->get(),
        ]);
    }

    public function leads(Request $request): Response
    {
        $site = $this->resolveSite();

        $leads = $site->leads()
            ->with(['contact:id,first_name,last_name,company', 'project:id,name'])
            ->latest()
            ->paginate(30);

        return Inertia::render('Website/Leads', [
            'leads' => $leads,
            'public_url' => route('sites.public.show', $site->slug),
        ]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

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
                'slug' => $this->uniqueSlug($studio->slug ?: $studio->name ?: 'studio'),
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

    /**
     * Persist the page tree. Top-level pages first (tracking the home + blog page),
     * then blog posts as children of the blog page. Slugs are de-duplicated to
     * respect the (site_id, slug) unique constraint.
     *
     * @param  array<int, array<string, mixed>>  $pages
     */
    private function syncPages(Site $site, array $pages): void
    {
        $site->pages()->delete();
        $pages = array_values($pages);

        // Categories live in their own table (not wiped here); only keep references
        // to ids that actually belong to this site, ignoring any stale client data.
        $validCategoryIds = $site->categories()->pluck('id')->map(fn ($id) => (int) $id)->all();

        $used = [];
        $uniqueSlug = function (string $base) use (&$used): string {
            $base = Str::slug($base) ?: 'page';
            $slug = $base;
            $n = 1;
            while (in_array($slug, $used, true)) {
                $slug = $base.'-'.(++$n);
            }
            $used[] = $slug;

            return $slug;
        };

        // ── First pass: top-level pages ──
        $homeAssigned = false;
        $blogPageId = null;
        $notFoundAssigned = false;
        $pos = 0;
        foreach ($pages as $page) {
            if (! empty($page['is_post'])) {
                continue;
            }
            $isHome = ! $homeAssigned && (bool) ($page['is_home'] ?? false);
            $homeAssigned = $homeAssigned || $isHome;
            $isBlog = $blogPageId === null && (bool) ($page['is_blog'] ?? false);
            $is404 = ! $notFoundAssigned && (bool) ($page['is_404'] ?? false);
            $notFoundAssigned = $notFoundAssigned || $is404;

            $created = $site->pages()->create([
                'studio_id' => $site->studio_id,
                'title' => $page['title'],
                'slug' => $uniqueSlug($page['slug'] ?: $page['title'] ?: 'page-'.($pos + 1)),
                'is_home' => $isHome,
                'is_blog' => $isBlog,
                'is_404' => $is404,
                'position' => $pos++,
                'blocks' => array_values($page['blocks'] ?? []),
                'hidden_category_ids' => array_values(array_intersect(
                    array_map('intval', $page['hidden_category_ids'] ?? []),
                    $validCategoryIds,
                )),
                'seo_title' => $page['seo_title'] ?? null,
                'seo_description' => $page['seo_description'] ?? null,
                'head_code' => $page['head_code'] ?? null,
                'body_code' => $page['body_code'] ?? null,
                'og_image' => $page['og_image'] ?? null,
            ]);

            if ($isBlog) {
                $blogPageId = $created->id;
            }
        }

        // Guarantee exactly one home page.
        if (! $homeAssigned && $first = $site->topPages()->first()) {
            $first->update(['is_home' => true]);
        }

        // ── Second pass: blog posts (children of the blog page) ──
        if ($blogPageId) {
            $pos = 0;
            foreach ($pages as $page) {
                if (empty($page['is_post'])) {
                    continue;
                }
                $status = ($page['status'] ?? 'published') === 'draft' ? 'draft' : 'published';
                $publishedAt = $this->blankToNull($page['published_at'] ?? null);
                if ($status === 'published' && ! $publishedAt) {
                    $publishedAt = now();
                }

                $site->pages()->create([
                    'studio_id' => $site->studio_id,
                    'parent_id' => $blogPageId,
                    'title' => $page['title'],
                    'slug' => $uniqueSlug($page['slug'] ?: $page['title'] ?: 'post-'.($pos + 1)),
                    'position' => $pos++,
                    'blocks' => array_values($page['blocks'] ?? []),
                    'status' => $status,
                    'published_at' => $publishedAt,
                    'excerpt' => $page['excerpt'] ?? null,
                    'category_ids' => array_values(array_intersect(
                        array_map('intval', $page['category_ids'] ?? []),
                        $validCategoryIds,
                    )),
                    'cover_image' => $page['cover_image'] ?? null,
                    'seo_title' => $page['seo_title'] ?? null,
                    'seo_description' => $page['seo_description'] ?? null,
                    'head_code' => $page['head_code'] ?? null,
                    'body_code' => $page['body_code'] ?? null,
                    'og_image' => $page['og_image'] ?? null,
                ]);
            }
        }
    }

    // ── Blog categories (WordPress-style hierarchical taxonomy) ──
    // Managed over ajax so the builder can add/rename/delete categories without a
    // full save that would clobber unsaved page edits. Each call returns the whole
    // (flat) list so the client just replaces its categories state.

    public function storeCategory(Request $request): JsonResponse
    {
        $site = $this->resolveSite();
        $data = $request->validate([
            'name' => 'required|string|max:80',
            'parent_id' => ['nullable', 'integer', Rule::exists('site_categories', 'id')->where('site_id', $site->id)],
        ]);

        $site->categories()->create([
            'studio_id' => $site->studio_id,
            'parent_id' => $data['parent_id'] ?? null,
            'name' => trim($data['name']),
            'slug' => $this->uniqueCategorySlug($site, $data['name']),
            'position' => (int) $site->categories()->max('position') + 1,
        ]);

        return response()->json(['categories' => $this->categoriesPayload($site)]);
    }

    public function updateCategory(Request $request, SiteCategory $category): JsonResponse
    {
        $site = $this->resolveSite();
        abort_unless($category->site_id === $site->id, 404);

        $data = $request->validate([
            'name' => 'required|string|max:80',
            'parent_id' => ['nullable', 'integer', Rule::exists('site_categories', 'id')->where('site_id', $site->id)],
        ]);

        // A category can't be its own ancestor — block self/descendant parents.
        $parentId = $data['parent_id'] ?? null;
        if ($parentId !== null && ($parentId === $category->id || in_array($parentId, $this->descendantIds($site, $category->id), true))) {
            $parentId = $category->parent_id;
        }

        $category->update([
            'name' => trim($data['name']),
            'parent_id' => $parentId,
        ]);

        return response()->json(['categories' => $this->categoriesPayload($site)]);
    }

    public function destroyCategory(SiteCategory $category): JsonResponse
    {
        $site = $this->resolveSite();
        abort_unless($category->site_id === $site->id, 404);

        DB::transaction(function () use ($site, $category) {
            // WordPress behaviour: children move up to the deleted category's parent.
            $site->categories()->where('parent_id', $category->id)->update(['parent_id' => $category->parent_id]);

            // Detach the category from every post that referenced it.
            foreach ($site->pages()->whereNotNull('category_ids')->get() as $post) {
                $ids = array_values(array_filter($post->category_ids ?? [], fn ($id) => (int) $id !== $category->id));
                if (count($ids) !== count($post->category_ids ?? [])) {
                    $post->update(['category_ids' => $ids]);
                }
            }

            $category->delete();
        });

        return response()->json(['categories' => $this->categoriesPayload($site)]);
    }

    /** @return list<array{id:int,name:string,slug:string,parent_id:int|null}> */
    private function categoriesPayload(Site $site): array
    {
        return $site->categories()->get()->map(fn (SiteCategory $c) => [
            'id' => $c->id,
            'name' => $c->name,
            'slug' => $c->slug,
            'parent_id' => $c->parent_id,
        ])->values()->all();
    }

    /** All descendant category ids of $id within the site (for cycle prevention). */
    private function descendantIds(Site $site, int $id): array
    {
        $all = $site->categories()->get(['id', 'parent_id']);
        $out = [];
        $walk = function (int $parent) use (&$walk, $all, &$out): void {
            foreach ($all->where('parent_id', $parent) as $child) {
                $out[] = $child->id;
                $walk($child->id);
            }
        };
        $walk($id);

        return $out;
    }

    private function uniqueCategorySlug(Site $site, string $name): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $n = 1;
        while ($site->categories()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.(++$n);
        }

        return $slug;
    }

    private function blankToNull(mixed $value): mixed
    {
        return ($value === '' || $value === null) ? null : $value;
    }

    /**
     * @return array<string, mixed>
     */
    /** Validation rules for the site-wide settings (shared by update + updateSettings). */
    private function siteRules(Site $site): array
    {
        return [
            'name' => 'required|string|max:255',
            'slug' => [
                'required', 'string', 'max:120', 'alpha_dash',
                Rule::unique('sites', 'slug')->ignore($site->id),
            ],
            'contact_email' => 'nullable|email|max:255',
            'auto_create_project' => 'boolean',
            'seo_title' => 'nullable|string|max:255',
            'seo_description' => 'nullable|string|max:500',
            'favicon_url' => 'nullable|string|max:2048',
            'og_image_url' => 'nullable|string|max:2048',
            'redirects' => 'array',
            'redirects.*.from' => 'nullable|string|max:300',
            'redirects.*.to' => 'nullable|string|max:2048',
            'theme' => 'array',
            'theme.primary_color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'theme.font' => ['nullable', Rule::in(['sans', 'serif'])],
            // Font registry keys (heading/body/logo). Freeform-but-bounded; the
            // renderer falls back to a system font for any unknown key.
            'theme.heading_font' => ['nullable', 'string', 'max:40'],
            'theme.body_font' => ['nullable', 'string', 'max:40'],
            'theme.logo_font' => ['nullable', 'string', 'max:40'],
            'theme.logo_color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'theme.nav_color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'header_nav' => 'array',
            'header_nav.*.label' => 'required|string|max:60',
            'header_nav.*.kind' => ['required', Rule::in(['page', 'url'])],
            'header_nav.*.target' => 'nullable|string|max:300',
            'footer_nav' => 'array',
            'footer_nav.*.label' => 'required|string|max:60',
            'footer_nav.*.kind' => ['required', Rule::in(['page', 'url'])],
            'footer_nav.*.target' => 'nullable|string|max:300',
            'head_code' => 'nullable|string|max:20000',
            'body_code' => 'nullable|string|max:20000',
            'cookie_consent' => 'boolean',
            'cookie_message' => 'nullable|string|max:1000',
            'cookie_policy_url' => 'nullable|string|max:500',
        ];
    }

    private function validateSite(Request $request, Site $site): array
    {
        return $request->validate([
            ...$this->siteRules($site),
            // Reusable sections are freeform block JSON — validate the array only.
            'saved_sections' => 'array|max:50',
            'pages' => 'array|min:1',
            'pages.*.title' => 'required|string|max:120',
            'pages.*.slug' => 'required|string|max:120',
            'pages.*.is_home' => 'boolean',
            'pages.*.is_blog' => 'boolean',
            'pages.*.is_404' => 'boolean',
            'pages.*.is_post' => 'boolean',
            'pages.*.status' => ['nullable', Rule::in(['draft', 'published'])],
            'pages.*.published_at' => 'nullable|date',
            'pages.*.excerpt' => 'nullable|string|max:1000',
            'pages.*.category_ids' => 'array',
            'pages.*.category_ids.*' => 'integer',
            'pages.*.hidden_category_ids' => 'array',
            'pages.*.hidden_category_ids.*' => 'integer',
            'pages.*.cover_image' => 'nullable|string|max:2048',
            // Validate the blocks array itself only — not its items. Blocks are
            // freeform/nested (grid blocks contain child blocks, every block can
            // carry style settings), and per-item rules would strip those keys.
            'pages.*.blocks' => 'array',
            'pages.*.seo_title' => 'nullable|string|max:255',
            'pages.*.seo_description' => 'nullable|string|max:500',
            'pages.*.head_code' => 'nullable|string|max:20000',
            'pages.*.body_code' => 'nullable|string|max:20000',
            'pages.*.og_image' => 'nullable|string|max:2048',
        ]);
    }

    /**
     * Normalise nav items, dropping blanks.
     *
     * @param  array<int, array<string, mixed>>  $nav
     * @return list<array{label: string, kind: string, target: string}>
     */
    private function cleanNav(array $nav): array
    {
        return collect($nav)
            ->map(fn ($item) => [
                'label' => trim((string) ($item['label'] ?? '')),
                'kind' => ($item['kind'] ?? 'page') === 'url' ? 'url' : 'page',
                'target' => trim((string) ($item['target'] ?? '')),
            ])
            ->filter(fn ($item) => $item['label'] !== '')
            ->values()
            ->all();
    }

    /**
     * Normalise redirects, dropping rows missing a from/to.
     *
     * @param  array<int, array<string, mixed>>  $redirects
     * @return list<array{from: string, to: string}>
     */
    private function cleanRedirects(array $redirects): array
    {
        return collect($redirects)
            ->map(fn ($r) => [
                'from' => trim((string) ($r['from'] ?? '')),
                'to' => trim((string) ($r['to'] ?? '')),
            ])
            ->filter(fn ($r) => $r['from'] !== '' && $r['to'] !== '')
            ->values()
            ->all();
    }

    private function uniqueSlug(string $base): string
    {
        $slug = Str::slug($base) ?: 'studio';
        $candidate = $slug;
        $n = 1;
        while (Site::where('slug', $candidate)->exists()) {
            $candidate = $slug.'-'.(++$n);
        }

        return $candidate;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Site $site): array
    {
        return [
            'id' => $site->id,
            'name' => $site->name,
            'slug' => $site->slug,
            'custom_domain' => $site->custom_domain,
            'domain_token' => $site->domain_token,
            'domain_verified' => $site->domainVerified(),
            'domain_live' => $site->domainLive(),
            'template' => $site->template,
            'theme' => $site->themeSettings(),
            'header_nav' => $site->header_nav ?? [],
            'footer_nav' => $site->footer_nav ?? [],
            'head_code' => $site->head_code,
            'body_code' => $site->body_code,
            'cookie_consent' => $site->cookie_consent,
            'cookie_message' => $site->cookie_message,
            'cookie_policy_url' => $site->cookie_policy_url,
            'contact_email' => $site->contact_email,
            'auto_create_project' => $site->auto_create_project,
            'seo_title' => $site->seo_title,
            'seo_description' => $site->seo_description,
            'favicon_url' => $site->favicon_url,
            'og_image_url' => $site->og_image_url,
            'redirects' => $site->redirects ?? [],
            'saved_sections' => $site->saved_sections ?? [],
            'is_published' => $site->is_published,
            'published_at' => $site->published_at?->toIso8601String(),
            'categories' => $site->categories->map(fn (SiteCategory $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
                'parent_id' => $c->parent_id,
            ])->values(),
            'pages' => $site->pages->map(fn (SitePage $p) => [
                'id' => $p->id,
                'parent_id' => $p->parent_id,
                'is_post' => $p->parent_id !== null,
                'title' => $p->title,
                'slug' => $p->slug,
                'is_home' => $p->is_home,
                'is_blog' => $p->is_blog,
                'is_404' => $p->is_404,
                'status' => $p->status,
                'published_at' => $p->published_at?->format('Y-m-d'),
                'excerpt' => $p->excerpt,
                'category_ids' => array_map('intval', $p->category_ids ?? []),
                'hidden_category_ids' => array_map('intval', $p->hidden_category_ids ?? []),
                'cover_image' => $p->cover_image,
                'blocks' => $p->blocks ?? [],
                'seo_title' => $p->seo_title,
                'seo_description' => $p->seo_description,
                'head_code' => $p->head_code,
                'body_code' => $p->body_code,
                'og_image' => $p->og_image,
            ])->values(),
        ];
    }
}
