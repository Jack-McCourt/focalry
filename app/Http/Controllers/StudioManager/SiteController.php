<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\Photo;
use App\Models\Site;
use App\Models\SitePage;
use App\Models\Studio;
use App\Support\SiteTemplates;
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
            $site->update([
                'name' => $data['name'],
                'slug' => $data['slug'],
                'contact_email' => $data['contact_email'] ?? null,
                'seo_title' => $data['seo_title'] ?? null,
                'seo_description' => $data['seo_description'] ?? null,
                'theme' => [
                    'primary_color' => $data['theme']['primary_color'] ?? '#171717',
                    'font' => $data['theme']['font'] ?? 'sans',
                ],
                'header_nav' => $this->cleanNav($data['header_nav'] ?? []),
                'footer_nav' => $this->cleanNav($data['footer_nav'] ?? []),
            ]);

            $this->syncPages($site, $data['pages'] ?? []);
        });

        return back()->with('success', 'Website saved.');
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
        ]);

        $site = $this->resolveSite();
        $studio = Studio::find($site->studio_id);

        DB::transaction(function () use ($site, $studio, $validated) {
            $site->update([
                'template' => $validated['template'],
                'theme' => SiteTemplates::theme($validated['template']),
                'header_nav' => SiteTemplates::headerNav($validated['template']),
                'footer_nav' => SiteTemplates::footerNav($validated['template']),
            ]);
            $site->pages()->delete();
            $this->seedPages($site, $validated['template'], $studio?->name ?? $site->name);
        });

        return back()->with('success', 'Template applied.');
    }

    /** Async image upload for block image fields. Returns JSON {url, path}. */
    public function uploadImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'required|image|mimes:png,jpg,jpeg,webp,gif|max:8192',
        ]);

        $studioId = app('current.studio.id');
        $path = $request->file('image')->store("studios/{$studioId}/site", 'public');

        return response()->json([
            'url' => Storage::disk('public')->url($path),
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
            'collections' => $collections->map(fn (Collection $c) => [
                'id' => $c->id,
                'title' => $c->title,
                'photos' => $c->photos
                    ->map(fn (Photo $p) => ['id' => $p->id, 'thumb' => $p->signedUrl('thumb', 180) ?? $p->signedUrl('web', 180)])
                    ->filter(fn ($p) => $p['thumb'])
                    ->values(),
            ])->filter(fn ($c) => count($c['photos']) > 0)->values(),
        ]);
    }

    /**
     * Import chosen gallery photos into the site by copying their web derivative
     * from Wasabi to the public disk — gallery URLs are short-lived/signed, so a
     * permanent copy is needed for the published site. Returns JSON {urls}.
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
            $key = $photo?->derivativeKey('web') ?? $photo?->derivativeKey('preview') ?? $photo?->derivativeKey('thumb');
            if (! $key) {
                continue;
            }

            try {
                $dest = "studios/{$studioId}/site/gallery/{$photo->id}-".Str::random(6).'.jpg';
                Storage::disk('public')->put($dest, Storage::disk('wasabi')->get($key));
                $urls[] = Storage::disk('public')->url($dest);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json(['urls' => $urls]);
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
        $pos = 0;
        foreach ($pages as $page) {
            if (! empty($page['is_post'])) {
                continue;
            }
            $isHome = ! $homeAssigned && (bool) ($page['is_home'] ?? false);
            $homeAssigned = $homeAssigned || $isHome;
            $isBlog = $blogPageId === null && (bool) ($page['is_blog'] ?? false);

            $created = $site->pages()->create([
                'studio_id' => $site->studio_id,
                'title' => $page['title'],
                'slug' => $uniqueSlug($page['slug'] ?: $page['title'] ?: 'page-'.($pos + 1)),
                'is_home' => $isHome,
                'is_blog' => $isBlog,
                'position' => $pos++,
                'blocks' => array_values($page['blocks'] ?? []),
                'seo_title' => $page['seo_title'] ?? null,
                'seo_description' => $page['seo_description'] ?? null,
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
                    'cover_image' => $page['cover_image'] ?? null,
                    'seo_title' => $page['seo_title'] ?? null,
                    'seo_description' => $page['seo_description'] ?? null,
                ]);
            }
        }
    }

    private function blankToNull(mixed $value): mixed
    {
        return ($value === '' || $value === null) ? null : $value;
    }

    /**
     * @return array<string, mixed>
     */
    private function validateSite(Request $request, Site $site): array
    {
        return $request->validate([
            'name' => 'required|string|max:255',
            'slug' => [
                'required', 'string', 'max:120', 'alpha_dash',
                Rule::unique('sites', 'slug')->ignore($site->id),
            ],
            'contact_email' => 'nullable|email|max:255',
            'seo_title' => 'nullable|string|max:255',
            'seo_description' => 'nullable|string|max:500',
            'theme' => 'array',
            'theme.primary_color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'theme.font' => ['nullable', Rule::in(['sans', 'serif'])],
            'header_nav' => 'array',
            'header_nav.*.label' => 'required|string|max:60',
            'header_nav.*.kind' => ['required', Rule::in(['page', 'url'])],
            'header_nav.*.target' => 'nullable|string|max:300',
            'footer_nav' => 'array',
            'footer_nav.*.label' => 'required|string|max:60',
            'footer_nav.*.kind' => ['required', Rule::in(['page', 'url'])],
            'footer_nav.*.target' => 'nullable|string|max:300',
            'pages' => 'array|min:1',
            'pages.*.title' => 'required|string|max:120',
            'pages.*.slug' => 'required|string|max:120',
            'pages.*.is_home' => 'boolean',
            'pages.*.is_blog' => 'boolean',
            'pages.*.is_post' => 'boolean',
            'pages.*.status' => ['nullable', Rule::in(['draft', 'published'])],
            'pages.*.published_at' => 'nullable|date',
            'pages.*.excerpt' => 'nullable|string|max:1000',
            'pages.*.cover_image' => 'nullable|string|max:2048',
            // Validate the blocks array itself only — not its items. Blocks are
            // freeform/nested (grid blocks contain child blocks, every block can
            // carry style settings), and per-item rules would strip those keys.
            'pages.*.blocks' => 'array',
            'pages.*.seo_title' => 'nullable|string|max:255',
            'pages.*.seo_description' => 'nullable|string|max:500',
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
            'template' => $site->template,
            'theme' => $site->themeSettings(),
            'header_nav' => $site->header_nav ?? [],
            'footer_nav' => $site->footer_nav ?? [],
            'contact_email' => $site->contact_email,
            'seo_title' => $site->seo_title,
            'seo_description' => $site->seo_description,
            'is_published' => $site->is_published,
            'published_at' => $site->published_at?->toIso8601String(),
            'pages' => $site->pages->map(fn (SitePage $p) => [
                'id' => $p->id,
                'parent_id' => $p->parent_id,
                'is_post' => $p->parent_id !== null,
                'title' => $p->title,
                'slug' => $p->slug,
                'is_home' => $p->is_home,
                'is_blog' => $p->is_blog,
                'status' => $p->status,
                'published_at' => $p->published_at?->format('Y-m-d'),
                'excerpt' => $p->excerpt,
                'cover_image' => $p->cover_image,
                'blocks' => $p->blocks ?? [],
                'seo_title' => $p->seo_title,
                'seo_description' => $p->seo_description,
            ])->values(),
        ];
    }
}
