<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Http\Controllers\StudioManager\Concerns\ResolvesSite;
use App\Models\Site;
use App\Models\SiteCategory;
use App\Models\SitePage;
use App\Models\SiteSnapshot;
use App\Models\SiteVisit;
use App\Models\Studio;
use App\Support\Ai;
use App\Support\InstagramApi;
use App\Support\LinkedGalleries;
use App\Support\SiteTemplates;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The website builder itself: builder/settings screens, draft saves, publish,
 * templates, page sync, analytics and leads. Domain, media, category and
 * Google-review endpoints live in their own Site*Controllers (all sharing
 * the ResolvesSite concern).
 */
class SiteController extends Controller
{
    use ResolvesSite;

    /** The website builder. Creates a starter site on first visit. */
    public function edit(): Response
    {
        $site = $this->resolveSite();

        return Inertia::render('Website/Builder', [
            // The builder edits the draft when one exists; the live site keeps
            // serving the published copy until Publish applies it.
            'site' => $this->serialize($site, withDraft: true),
            'templates' => SiteTemplates::all(),
            'public_url' => $site->publicUrl(),
            'leads_count' => $site->leads()->count(),
            'has_draft' => is_array($site->draft),
            'ai_available' => Ai::configured(),
        ]);
    }

    /**
     * Builder saves (incl. autosave) land in the site's draft. Nothing changes
     * on the live site until the studio clicks Publish.
     */
    public function update(Request $request): RedirectResponse
    {
        $site = $this->resolveSite();

        // Optimistic concurrency: the builder echoes the version it loaded
        // (draft_saved_at ?? updated_at). A stale token means another tab (or
        // person) saved since — reject rather than silently clobber their work.
        $clientVersion = (string) $request->input('version', '');
        if ($clientVersion !== '' && $clientVersion !== $this->siteVersion($site)) {
            return back()->withErrors([
                'version' => 'This site was changed in another tab or by someone else. Reload the builder to pick up the latest version before saving.',
            ]);
        }

        $data = $this->validateSite($request, $site);

        $site->update(['draft' => $data, 'draft_saved_at' => now()]);

        return back()->with('success', 'Draft saved.');
    }

    /**
     * The builder's optimistic-lock token. A content hash rather than a
     * timestamp: the timestamp columns are second-precision, so two rapid
     * saves (e.g. autosaves from two tabs) would be indistinguishable.
     */
    private function siteVersion(Site $site): string
    {
        return md5(json_encode([$site->draft, (string) $site->draft_saved_at, (string) $site->updated_at]));
    }

    /** Throw away the draft, returning the builder to the live version. */
    public function discardDraft(): RedirectResponse
    {
        $site = $this->resolveSite();
        $site->update(['draft' => null, 'draft_saved_at' => null]);

        return back()->with('success', 'Draft discarded.');
    }

    /** Load a published snapshot into the draft (nothing goes live until Publish). */
    public function restoreSnapshot(SiteSnapshot $snapshot): RedirectResponse
    {
        $site = $this->resolveSite();
        abort_unless($snapshot->site_id === $site->id, 404);

        $site->update(['draft' => $snapshot->payload, 'draft_saved_at' => now()]);

        return redirect()->route('website.edit')
            ->with('success', 'Version from '.$snapshot->created_at->format('j M, H:i').' restored as a draft — review it and press Publish to put it live.');
    }

    /** Create (or rotate) the shareable draft-preview link. */
    public function createPreviewLink(): RedirectResponse
    {
        $site = $this->resolveSite();
        $site->update(['preview_token' => Str::random(48)]);

        return back()->with('success', 'Preview link created.');
    }

    /** Revoke the shareable preview link. */
    public function revokePreviewLink(): RedirectResponse
    {
        $this->resolveSite()->update(['preview_token' => null]);

        return back()->with('success', 'Preview link revoked.');
    }

    /** The site settings page (separate from the builder). */
    public function settings(): Response
    {
        $site = $this->resolveSite();

        return Inertia::render('Website/Settings', [
            'site' => $this->serialize($site),
            'snapshots' => $site->snapshots()->limit(10)->get()->map(fn (SiteSnapshot $sn) => [
                'id' => $sn->id,
                'published_at' => $sn->created_at->toIso8601String(),
                'pages' => count($sn->payload['pages'] ?? []),
                'name' => $sn->payload['name'] ?? $site->name,
            ]),
            'templates' => SiteTemplates::all(),
            'public_url' => $site->publicUrl(),
            'domain_config' => config('services.custom_domains'),
            'studio_logo' => $site->studio?->logoUrl(),
            'site_logo' => $site->logoUrl(),
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

    /**
     * Write the site-wide settings fields (everything except pages/sections).
     * Fields absent from the payload keep their current value — the builder and
     * the settings page each submit only the fields they manage, so one saving
     * must never wipe what the other set (e.g. custom_css, auto_create_project).
     */
    private function applySiteSettings(Site $site, array $data): void
    {
        // Present-but-null clears a field; absent keeps the current value.
        $keep = fn (string $key) => array_key_exists($key, $data) ? $data[$key] : $site->{$key};

        // Turnstile: the (public) site key round-trips through the form, so an
        // empty value clears the pair. The secret is write-only — it's never
        // sent back to the browser, so only overwrite when a new one is typed.
        $turnstile = [];
        if (array_key_exists('turnstile_site_key', $data)) {
            $siteKey = trim((string) ($data['turnstile_site_key'] ?? ''));
            $turnstile['turnstile_site_key'] = $siteKey !== '' ? $siteKey : null;
            if ($siteKey === '') {
                $turnstile['turnstile_secret_key'] = null;
            }
        }
        if (trim((string) ($data['turnstile_secret_key'] ?? '')) !== '') {
            $turnstile['turnstile_secret_key'] = trim((string) $data['turnstile_secret_key']);
        }

        $site->update($turnstile + [
            'name' => $data['name'],
            'slug' => $data['slug'],
            'contact_email' => $keep('contact_email'),
            'auto_create_project' => array_key_exists('auto_create_project', $data)
                ? (bool) $data['auto_create_project']
                : (bool) ($site->auto_create_project ?? true),
            'seo_title' => $keep('seo_title'),
            'seo_description' => $keep('seo_description'),
            'favicon_url' => $keep('favicon_url'),
            'og_image_url' => $keep('og_image_url'),
            'redirects' => array_key_exists('redirects', $data)
                ? $this->cleanRedirects($data['redirects'] ?? [])
                : ($site->redirects ?? []),
            'theme' => [
                'primary_color' => $data['theme']['primary_color'] ?? '#171717',
                'font' => $data['theme']['font'] ?? 'sans',
                'heading_font' => $data['theme']['heading_font'] ?? ($data['theme']['font'] ?? 'sans'),
                'body_font' => $data['theme']['body_font'] ?? ($data['theme']['font'] ?? 'sans'),
                'heading_weight' => $data['theme']['heading_weight'] ?? null,
                'body_weight' => $data['theme']['body_weight'] ?? null,
                'logo_font' => $data['theme']['logo_font'] ?? '',
                'logo_color' => $data['theme']['logo_color'] ?? '',
                'nav_color' => $data['theme']['nav_color'] ?? '',
                'text_color' => $data['theme']['text_color'] ?? '',
                'nav_size' => $data['theme']['nav_size'] ?? ($site->theme['nav_size'] ?? 'sm'),
                'logo_size' => $data['theme']['logo_size'] ?? ($site->theme['logo_size'] ?? 'sm'),
                'header_logo_size' => $data['theme']['header_logo_size'] ?? ($site->theme['header_logo_size'] ?? 'medium'),
                'style' => $data['theme']['style'] ?? ($site->theme['style'] ?? 'classic'),
                'header_style' => $data['theme']['header_style'] ?? ($site->theme['header_style'] ?? 'solid'),
                'width' => $data['theme']['width'] ?? ($site->theme['width'] ?? 'normal'),
            ],
            'announcement' => array_key_exists('announcement', $data) ? ($data['announcement'] ?? []) : ($site->announcement ?? []),
            'social' => array_key_exists('social', $data) ? ($data['social'] ?? []) : ($site->social ?? []),
            'footer' => array_key_exists('footer', $data) ? ($data['footer'] ?? []) : ($site->footer ?? []),
            'coming_soon' => array_key_exists('coming_soon', $data) ? (bool) $data['coming_soon'] : (bool) $site->coming_soon,
            'custom_fonts' => array_key_exists('custom_fonts', $data) ? array_values($data['custom_fonts'] ?? []) : ($site->custom_fonts ?? []),
            'header_nav' => array_key_exists('header_nav', $data) ? $this->cleanNav($data['header_nav'] ?? []) : ($site->header_nav ?? []),
            'footer_nav' => array_key_exists('footer_nav', $data) ? $this->cleanNav($data['footer_nav'] ?? []) : ($site->footer_nav ?? []),
            'head_code' => $keep('head_code'),
            'body_code' => $keep('body_code'),
            'custom_css' => $keep('custom_css'),
            'cookie_consent' => array_key_exists('cookie_consent', $data) ? (bool) $data['cookie_consent'] : (bool) $site->cookie_consent,
            'cookie_message' => $keep('cookie_message'),
            'cookie_policy_url' => $keep('cookie_policy_url'),
        ]);
    }

    /**
     * Publish applies the pending draft (settings + pages) to the live site and
     * flips it public. Unpublish just hides the site — the draft (and the live
     * content) are kept.
     */
    public function publish(Request $request): RedirectResponse
    {
        $site = $this->resolveSite();

        if (! $request->boolean('publish')) {
            $site->update(['is_published' => false]);

            return back()->with('success', 'Website unpublished.');
        }

        DB::transaction(function () use ($site) {
            // Serialize concurrent publishes (e.g. a double-click sends two
            // POSTs): the second waits here, then re-reads — by which time the
            // first has cleared the draft, so it skips the delete/recreate
            // instead of racing it into duplicate-slug violations.
            $site = Site::whereKey($site->id)->lockForUpdate()->firstOrFail();

            if (is_array($site->draft)) {
                $draft = $site->draft;
                $this->applySiteSettings($site, $draft);
                $site->update(['saved_sections' => array_values($draft['saved_sections'] ?? [])]);
                $this->syncPages($site, $draft['pages'] ?? []);

                // Version history: keep the payload that just went live (last 10),
                // restorable into the draft for one-click rollback.
                $site->snapshots()->create(['studio_id' => $site->studio_id, 'payload' => $draft]);
                $site->snapshots()->orderByDesc('id')->skip(10)->take(100)->pluck('id')
                    ->whenNotEmpty(fn ($ids) => SiteSnapshot::withoutGlobalScopes()->whereIn('id', $ids)->delete());
            }

            $site->update([
                'is_published' => true,
                'published_at' => $site->published_at ?? now(),
                'draft' => null,
                'draft_saved_at' => null,
            ]);
        });

        // Refresh linked gallery blocks so a publish always reflects the
        // current client-gallery contents (the nightly sync covers the rest).
        LinkedGalleries::syncSiteBlocks($site->refresh());

        return back()->with('success', 'Website published.');
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
            $update = [
                'template' => $template,
                'theme' => SiteTemplates::theme($template),
            ];

            // Keep a pending draft in step, or its stale theme would mask the
            // new style in the builder (which edits the draft when one exists).
            if (is_array($site->draft)) {
                $draft = $site->draft;
                $draft['theme'] = SiteTemplates::theme($template);
                $update['draft'] = $draft;
            }

            $site->update($update);

            return back()->with('success', 'Template style applied — your content was kept.');
        }

        // Opt-in: replace everything with the template's sample pages (fresh start).
        $studio = Studio::find($site->studio_id);

        DB::transaction(function () use ($site, $studio, $template) {
            // Same double-click guard as publish() — delete+reseed must not race.
            $site = Site::whereKey($site->id)->lockForUpdate()->firstOrFail();

            $site->update([
                'template' => $template,
                'theme' => SiteTemplates::theme($template),
                'header_nav' => SiteTemplates::headerNav($template),
                'footer_nav' => SiteTemplates::footerNav($template),
                // A fresh start supersedes any pending draft.
                'draft' => null,
                'draft_saved_at' => null,
            ]);
            SitePage::withoutGlobalScopes()->where('site_id', $site->id)->delete();
            $this->seedPages($site, $template, $studio?->name ?? $site->name);
        });

        return back()->with('success', 'Template applied.');
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
        $uniques = (int) (clone $base)->distinct('visitor_hash')->count('visitor_hash');
        $devices = (clone $base)->whereNotNull('device')
            ->selectRaw('device, COUNT(*) as c')->groupBy('device')->pluck('c', 'device');
        $leads = $site->leads()->where('created_at', '>=', $since)->count();

        return Inertia::render('Website/Analytics', [
            'public_url' => $site->publicUrl(),
            // Instagram connection state for the feed block's editor.
            'instagram' => [
                'available' => InstagramApi::configured(),
                'connected' => (bool) $site->instagram_token,
                'username' => $site->instagram_username,
            ],
            'is_published' => $site->is_published,
            'range_days' => $days,
            'series' => $series,
            'total_views' => $totalViews,
            'total_leads' => $leads,
            'conversion' => $totalViews > 0 ? round($leads / $totalViews * 100, 1) : 0,
            'top_pages' => (clone $base)->selectRaw('path, COUNT(*) as c')->groupBy('path')->orderByDesc('c')->limit(8)->get(),
            'top_referrers' => (clone $base)->whereNotNull('referrer_host')->selectRaw('referrer_host, COUNT(*) as c')->groupBy('referrer_host')->orderByDesc('c')->limit(8)->get(),
            'unique_visitors' => $uniques,
            'devices' => $devices,
            'top_sources' => (clone $base)->whereNotNull('utm_source')->selectRaw('utm_source, COUNT(*) as c')->groupBy('utm_source')->orderByDesc('c')->limit(8)->get(),
        ]);
    }

    public function leads(Request $request): Response
    {
        $site = $this->resolveSite();

        $leads = $site->leads()
            ->with(['contact:id,first_name,last_name,company', 'project:id,name'])
            ->latest()
            ->paginate(30)
            // Attachments are stored privately; expose a short-lived signed URL
            // in the payload (older leads carry a legacy public attachment_url).
            ->through(function ($lead) {
                $payload = $lead->payload ?? [];
                if (! empty($payload['attachment_path'])) {
                    try {
                        $payload['attachment_url'] = Storage::disk('wasabi')
                            ->temporaryUrl($payload['attachment_path'], now()->addMinutes(30));
                    } catch (\Throwable $e) {
                        report($e);
                    }
                }
                $lead->setAttribute('payload', $payload);

                return $lead;
            });

        return Inertia::render('Website/Leads', [
            'leads' => $leads,
            'public_url' => $site->publicUrl(),
        ]);
    }

    /** Newsletter subscribers captured by the site's newsletter block. */
    public function subscribers(Request $request): Response
    {
        $site = $this->resolveSite();

        return Inertia::render('Website/Subscribers', [
            'subscribers' => $site->subscribers()->latest()->paginate(50),
            'total' => $site->subscribers()->count(),
        ]);
    }

    /** CSV export — the hand-off to Mailchimp/Flodesk/any email tool. */
    public function exportSubscribers(): StreamedResponse
    {
        $site = $this->resolveSite();

        return response()->streamDownload(function () use ($site) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['email', 'name', 'source', 'subscribed_at']);
            $site->subscribers()->latest()->chunk(500, function ($rows) use ($out) {
                foreach ($rows as $s) {
                    fputcsv($out, [$s->email, $s->name, $s->source, $s->created_at?->toDateTimeString()]);
                }
            });
            fclose($out);
        }, 'subscribers.csv', ['Content-Type' => 'text/csv']);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Persist the page tree. Top-level pages first (tracking the home + blog page),
     * then blog posts as children of the blog page. Slugs are de-duplicated to
     * respect the (site_id, slug) unique constraint.
     *
     * @param  array<int, array<string, mixed>>  $pages
     */
    private function syncPages(Site $site, array $pages): void
    {
        // Without the studio scope: every row of THIS site must go, even if a
        // legacy import ever left one with a stray studio_id.
        SitePage::withoutGlobalScopes()->where('site_id', $site->id)->delete();
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
                // Blog pages carry the shared post-header design here.
                'header' => is_array($page['header'] ?? null) ? $page['header'] : null,
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
                    'author' => $page['author'] ?? null,
                    'category_ids' => array_values(array_intersect(
                        array_map('intval', $page['category_ids'] ?? []),
                        $validCategoryIds,
                    )),
                    'cover_image' => $page['cover_image'] ?? null,
                    'cover_focal' => $this->normalizeFocal($page['cover_focal'] ?? null),
                    'header' => is_array($page['header'] ?? null) ? $page['header'] : null,
                    'seo_title' => $page['seo_title'] ?? null,
                    'seo_description' => $page['seo_description'] ?? null,
                    'head_code' => $page['head_code'] ?? null,
                    'body_code' => $page['body_code'] ?? null,
                    'og_image' => $page['og_image'] ?? null,
                ]);
            }
        }
    }

    private function blankToNull(mixed $value): mixed
    {
        return ($value === '' || $value === null) ? null : $value;
    }

    /**
     * Clamp a client-supplied focal point to {x,y} percentages (0–100), or null.
     *
     * @return array{x:int,y:int}|null
     */
    private function normalizeFocal(mixed $focal): ?array
    {
        if (! is_array($focal) || ! isset($focal['x'], $focal['y'])) {
            return null;
        }

        return [
            'x' => max(0, min(100, (int) $focal['x'])),
            'y' => max(0, min(100, (int) $focal['y'])),
        ];
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
            'theme.heading_weight' => ['nullable', 'integer', 'between:100,900'],
            'theme.body_weight' => ['nullable', 'integer', 'between:100,900'],
            'theme.logo_font' => ['nullable', 'string', 'max:40'],
            'theme.logo_color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'theme.nav_color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'theme.text_color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'theme.header_style' => ['nullable', Rule::in(['solid', 'transparent'])],
            // Sizing controls. Without an explicit rule, Laravel's validator strips
            // these sub-keys out of the validated array (nested rules on siblings
            // make it whitelist-only), so the Settings save would silently drop them.
            'theme.nav_size' => ['nullable', 'string', 'max:10'],
            'theme.logo_size' => ['nullable', 'string', 'max:10'],
            'theme.header_logo_size' => ['nullable', Rule::in(['small', 'medium', 'large', 'xlarge'])],
            // Announcement bar / social links / footer info (site-wide chrome).
            'announcement' => 'array',
            'announcement.enabled' => 'boolean',
            'announcement.text' => 'nullable|string|max:200',
            'announcement.link' => 'nullable|string|max:500',
            'announcement.background' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'social' => 'array',
            'social.instagram' => 'nullable|string|max:300',
            'social.facebook' => 'nullable|string|max:300',
            'social.pinterest' => 'nullable|string|max:300',
            'social.tiktok' => 'nullable|string|max:300',
            'social.youtube' => 'nullable|string|max:300',
            'footer' => 'array',
            'footer.tagline' => 'nullable|string|max:300',
            'footer.email' => 'nullable|email|max:255',
            'footer.phone' => 'nullable|string|max:50',
            'footer.show_social' => 'boolean',
            'footer.logo_size' => ['nullable', Rule::in(['small', 'medium', 'large', 'xlarge'])],
            'coming_soon' => 'boolean',
            'custom_fonts' => 'array|max:4',
            'custom_fonts.*.name' => 'required|string|max:40',
            'custom_fonts.*.url' => 'required|string|max:2048',
            // Studio's own Turnstile widget keys (optional; overrides platform).
            'turnstile_site_key' => 'nullable|string|max:100',
            'turnstile_secret_key' => 'nullable|string|max:100',
            'header_nav' => 'array',
            'header_nav.*.label' => 'required|string|max:60',
            'header_nav.*.kind' => ['required', Rule::in(['page', 'url'])],
            'header_nav.*.target' => 'nullable|string|max:300',
            'header_nav.*.style' => ['nullable', Rule::in(['link', 'button'])],
            // One level of dropdown links (header only — the footer stays flat,
            // its validation has no children rules so validate() strips them).
            'header_nav.*.children' => 'array',
            'header_nav.*.children.*.label' => 'required|string|max:60',
            'header_nav.*.children.*.kind' => ['required', Rule::in(['page', 'url'])],
            'header_nav.*.children.*.target' => 'nullable|string|max:300',
            'footer_nav' => 'array',
            'footer_nav.*.label' => 'required|string|max:60',
            'footer_nav.*.kind' => ['required', Rule::in(['page', 'url'])],
            'footer_nav.*.target' => 'nullable|string|max:300',
            'head_code' => 'nullable|string|max:20000',
            'body_code' => 'nullable|string|max:20000',
            'custom_css' => 'nullable|string|max:50000',
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
            // Slug may be blank — syncPages() derives a unique one from the title.
            // (Posts are created with an empty slug on purpose: "auto from title".)
            'pages.*.slug' => 'nullable|string|max:120',
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
            'pages.*.author' => 'nullable|string|max:120',
            'pages.*.cover_image' => 'nullable|string|max:2048',
            'pages.*.cover_focal' => 'nullable|array',
            'pages.*.cover_focal.x' => 'nullable|numeric',
            'pages.*.cover_focal.y' => 'nullable|numeric',
            // Freeform header style options (validated as an array only).
            'pages.*.header' => 'nullable|array',
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
    private function cleanNav(array $nav, bool $allowChildren = true): array
    {
        return collect($nav)
            ->map(function ($item) use ($allowChildren) {
                $clean = [
                    'label' => trim((string) ($item['label'] ?? '')),
                    'kind' => ($item['kind'] ?? 'page') === 'url' ? 'url' : 'page',
                    'target' => trim((string) ($item['target'] ?? '')),
                ];

                // Header extras: a CTA-button style and one level of dropdown links.
                if (($item['style'] ?? null) === 'button') {
                    $clean['style'] = 'button';
                }
                if ($allowChildren && is_array($item['children'] ?? null)) {
                    $children = $this->cleanNav($item['children'], false);
                    if ($children !== []) {
                        $clean['children'] = $children;
                    }
                }

                return $clean;
            })
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

    /**
     * @return array<string, mixed>
     */
    private function serialize(Site $site, bool $withDraft = false): array
    {
        $out = [
            'id' => $site->id,
            // Optimistic-lock token echoed back by builder saves (see update()).
            'version' => $this->siteVersion($site),
            'name' => $site->name,
            'slug' => $site->slug,
            'custom_domain' => $site->custom_domain,
            'domain_token' => $site->domain_token,
            'domain_verified' => $site->domainVerified(),
            'domain_live' => $site->domainLive(),
            'public_url' => $site->publicUrl(),
            'template' => $site->template,
            'theme' => $site->themeSettings(),
            'header_nav' => $site->header_nav ?? [],
            'footer_nav' => $site->footer_nav ?? [],
            'head_code' => $site->head_code,
            'body_code' => $site->body_code,
            'custom_css' => $site->custom_css,
            'cookie_consent' => $site->cookie_consent,
            'cookie_message' => $site->cookie_message,
            'cookie_policy_url' => $site->cookie_policy_url,
            'contact_email' => $site->contact_email,
            'auto_create_project' => $site->auto_create_project,
            'seo_title' => $site->seo_title,
            'seo_description' => $site->seo_description,
            'favicon_url' => $site->favicon_url,
            'og_image_url' => $site->og_image_url,
            'announcement' => $site->announcement ?? [],
            'social' => $site->social ?? [],
            'footer' => $site->footer ?? [],
            // The header logo shown in the builder preview: the site's own logo,
            // else the studio-wide fallback (mirrors the live site's studio_logo prop).
            'logo_url' => $site->headerLogoUrl(),
            'footer_logo' => $site->footerLogoUrl(),
            'coming_soon' => (bool) $site->coming_soon,
            'custom_fonts' => $site->custom_fonts ?? [],
            // The secret never leaves the server — the UI only needs to know it exists.
            'turnstile_site_key' => $site->turnstile_site_key,
            'turnstile_secret_set' => (bool) $site->turnstile_secret_key,
            'preview_url' => $site->preview_token ? route('sites.public.preview', $site->preview_token) : null,
            'redirects' => $site->redirects ?? [],
            'saved_sections' => $site->saved_sections ?? [],
            // Instagram connection state for the feed block's editor.
            'instagram' => [
                'available' => InstagramApi::configured(),
                'connected' => (bool) $site->instagram_token,
                'username' => $site->instagram_username,
            ],
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
                'author' => $p->author,
                'category_ids' => array_map('intval', $p->category_ids ?? []),
                'hidden_category_ids' => array_map('intval', $p->hidden_category_ids ?? []),
                'cover_image' => $p->cover_image,
                'cover_focal' => $p->cover_focal,
                'header' => $p->header,
                'blocks' => $p->blocks ?? [],
                'seo_title' => $p->seo_title,
                'seo_description' => $p->seo_description,
                'head_code' => $p->head_code,
                'body_code' => $p->body_code,
                'og_image' => $p->og_image,
            ])->values(),
        ];

        // Overlay the pending draft so the builder resumes work-in-progress.
        // The draft is the validated builder payload, so its shape matches what
        // the builder sent (and expects back). Live-only fields (id, domain,
        // publish state, categories) stay from the live record.
        if ($withDraft && is_array($site->draft)) {
            $draft = $site->draft;
            $overlay = [
                'name', 'slug', 'contact_email', 'seo_title', 'seo_description',
                'favicon_url', 'og_image_url', 'redirects', 'saved_sections',
                'theme', 'header_nav', 'footer_nav', 'head_code', 'body_code',
                'cookie_consent', 'cookie_message', 'cookie_policy_url',
            ];
            foreach ($overlay as $key) {
                if (array_key_exists($key, $draft)) {
                    $out[$key] = $draft[$key];
                }
            }
            if (array_key_exists('pages', $draft)) {
                $out['pages'] = array_values($draft['pages']);
            }
        }

        return $out;
    }
}
