<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Mail\ClientMessage;
use App\Models\Contact;
use App\Models\Package;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\ProjectType;
use App\Models\Site;
use App\Models\SiteCategory;
use App\Models\SiteLead;
use App\Models\SitePage;
use App\Models\SiteSubscriber;
use App\Models\User;
use App\Notifications\NewLead;
use App\Support\SiteVisits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Inertia\Inertia;
use Inertia\Response;

class PublicSiteController extends Controller
{
    /**
     * The custom domain this request is being served on, or null for the normal
     * /site/{slug} path. Set by the ResolveCustomDomain middleware (which rewrites
     * the request to /site/{slug}/... and stamps this attribute), and read here to
     * emit clean root-relative links and canonical URLs on the custom domain.
     */
    private function domainHost(): ?string
    {
        return request()->attributes->get('site_domain_host');
    }

    /** Absolute URL for a site path, on the custom domain when serving via one. */
    private function siteUrl(Site $site, string $suffix = ''): string
    {
        $suffix = ltrim($suffix, '/');
        if ($base = request()->attributes->get('site_preview_base')) {
            return url($base.($suffix !== '' ? '/'.$suffix : ''));
        }
        if ($host = $this->domainHost()) {
            return 'https://'.$host.($suffix !== '' ? '/'.$suffix : '');
        }

        return url('/site/'.$site->slug.($suffix !== '' ? '/'.$suffix : ''));
    }

    /** Root-relative base for in-page links ('' on a custom domain). */
    private function basePath(Site $site): string
    {
        if ($base = request()->attributes->get('site_preview_base')) {
            return $base;
        }

        return $this->domainHost() ? '' : '/site/'.$site->slug;
    }

    public function show(Request $request, string $slug, ?string $page = null)
    {
        // Unpublished sites can opt into a branded "coming soon" holding page
        // instead of a bare 404 (great while collecting enquiries pre-launch).
        $site = Site::withoutGlobalScopes()
            ->with(['pages', 'studio', 'categories'])
            ->where('slug', $slug)
            ->firstOrFail();

        if (! $site->is_published) {
            abort_unless($site->coming_soon, 404);

            return Inertia::render('Sites/ComingSoon', [
                'name' => $site->name,
                'studio_logo' => $site->headerLogoUrl(),
                'favicon_url' => $site->favicon_url,
                'contact_email' => $site->contact_email,
                'theme' => $site->themeSettings(),
            ]);
        }

        return $this->renderPage($request, $site, $page);
    }

    /** Tokenized draft preview: renders the work-in-progress draft (noindex). */
    public function preview(Request $request, string $token, ?string $page = null)
    {
        return $this->renderPage($request, $this->resolvePreview($request, $token), $page);
    }

    public function previewPost(Request $request, string $token, string $parent, string $post): Response
    {
        return $this->renderPost($request, $this->resolvePreview($request, $token), $parent, $post);
    }

    /**
     * Resolve a site by preview token and overlay its draft IN MEMORY (transient
     * SitePage models — nothing is written), so the link shows exactly what
     * Publish would produce. Marks the request as a preview: links use the
     * preview base, robots get noindex, and no visit is recorded.
     */
    private function resolvePreview(Request $request, string $token): Site
    {
        $site = Site::withoutGlobalScopes()
            ->with(['pages', 'studio', 'categories'])
            ->where('preview_token', $token)
            ->firstOrFail();

        $request->attributes->set('site_preview', true);
        $request->attributes->set('site_preview_base', '/site/preview/'.$token);

        if (! is_array($site->draft)) {
            return $site;
        }

        $draft = $site->draft;
        foreach (['name', 'seo_title', 'seo_description', 'favicon_url', 'og_image_url', 'theme', 'header_nav', 'footer_nav', 'custom_css'] as $key) {
            if (array_key_exists($key, $draft)) {
                $site->setAttribute($key, $draft[$key]);
            }
        }

        // Hydrate transient pages from the draft (two passes: pages, then posts).
        $pages = collect();
        $blogPageId = null;
        $id = 0;
        foreach (array_values($draft['pages'] ?? []) as $p) {
            if (! empty($p['is_post'])) {
                continue;
            }
            $model = new SitePage([
                'title' => $p['title'] ?? '',
                'slug' => $p['slug'] ?: str($p['title'] ?? 'page')->slug()->value(),
                'is_home' => (bool) ($p['is_home'] ?? false),
                'is_blog' => (bool) ($p['is_blog'] ?? false),
                'is_404' => (bool) ($p['is_404'] ?? false),
                'blocks' => array_values($p['blocks'] ?? []),
                'hidden_category_ids' => $p['hidden_category_ids'] ?? [],
                'header' => is_array($p['header'] ?? null) ? $p['header'] : null,
                'seo_title' => $p['seo_title'] ?? null,
                'seo_description' => $p['seo_description'] ?? null,
                'og_image' => $p['og_image'] ?? null,
                'position' => $id,
            ]);
            $model->id = ++$id;
            if ($model->is_blog) {
                $blogPageId = $model->id;
            }
            $pages->push($model);
        }
        foreach (array_values($draft['pages'] ?? []) as $p) {
            if (empty($p['is_post']) || ! $blogPageId) {
                continue;
            }
            $model = new SitePage([
                'parent_id' => $blogPageId,
                'title' => $p['title'] ?? '',
                'slug' => $p['slug'] ?: str($p['title'] ?? 'post')->slug()->value(),
                'blocks' => array_values($p['blocks'] ?? []),
                'status' => ($p['status'] ?? 'published') === 'draft' ? 'draft' : 'published',
                'published_at' => $p['published_at'] ?: now(),
                'excerpt' => $p['excerpt'] ?? null,
                'category_ids' => $p['category_ids'] ?? [],
                'cover_image' => $p['cover_image'] ?? null,
                'cover_focal' => is_array($p['cover_focal'] ?? null) ? $p['cover_focal'] : null,
                'header' => is_array($p['header'] ?? null) ? $p['header'] : null,
                'position' => $id,
            ]);
            $model->id = ++$id;
            $pages->push($model);
        }
        $site->setRelation('pages', $pages);

        return $site;
    }

    private function renderPage(Request $request, Site $site, ?string $page = null)
    {
        // Path redirects run before page lookup.
        if ($redirect = $this->matchRedirect($site, $page ?? '')) {
            return redirect($redirect, 301);
        }

        // Only top-level pages are reachable directly (posts live under the blog page).
        $top = $site->pages->whereNull('parent_id');
        $current = $page
            ? $top->firstWhere('slug', $page)
            : ($top->firstWhere('is_home', true) ?? $top->first());

        // No such page → render the studio's custom 404 page if they have one.
        if (! $current) {
            $notFound = $top->firstWhere('is_404', true);
            abort_if(! $notFound, 404);

            return $this->pageResponse($site, $notFound)->toResponse(request())->setStatusCode(404);
        }

        $this->recordVisit($site, $page ?? '', $request);

        return $this->pageResponse($site, $current, $request);
    }

    /** Build the Inertia page response for a resolved page. */
    private function pageResponse(Site $site, SitePage $current, ?Request $request = null): Response
    {
        // Only assemble (and ship) the data the page's blocks actually use —
        // a 150-post blog shouldn't be serialized into the homepage payload.
        $needsPosts = $this->hasBlockType($current, 'blog');

        $posts = $needsPosts ? $this->postCards($site) : collect();
        $blogState = null;

        // A paginating blog block gets paginated SERVER-side (?page / ?category),
        // so a 200-post blog ships one page of posts, not the whole archive.
        // Non-paginating blog blocks ("latest 3 posts" etc.) keep the simple path.
        if ($needsPosts && $request && ($blockData = $this->firstBlockData($current, 'blog')) && (int) ($blockData['per_page'] ?? 0) > 0) {
            [$posts, $blogState] = $this->paginatePosts($site, $posts, $blockData, $request);
        }

        return Inertia::render('Sites/Public', [
            'site' => $this->siteProps($site, $current),
            'studio_logo' => $site->headerLogoUrl(),
            'pages' => $this->topNav($site),
            'posts' => $posts,
            'categories' => $needsPosts ? $this->siteCategories($site) : collect(),
            'packages' => $this->hasBlockType($current, 'packages') ? $this->packageCards($site) : collect(),
            'blog_state' => $blogState,
            'page' => [
                'title' => $current->title,
                'slug' => $current->slug,
                'is_home' => $current->is_home,
                'blocks' => $current->blocks ?? [],
                'head_code' => $current->head_code,
                'body_code' => $current->body_code,
                'og_image' => $current->og_image,
                'canonical' => $current->is_home ? $this->siteUrl($site) : $this->siteUrl($site, $current->slug),
            ],
        ]);
    }

    /**
     * Filter (by ?category, including its descendants) and slice (?page) the
     * post cards for a paginating blog block.
     *
     * @param  Collection<int, array<string, mixed>>  $posts
     * @param  array<string, mixed>  $blockData
     * @return array{0: Collection<int, array<string, mixed>>, 1: array<string, mixed>}
     */
    private function paginatePosts(Site $site, Collection $posts, array $blockData, Request $request): array
    {
        $perPage = (int) $blockData['per_page'];

        // Category filter — a parent category includes its descendants' posts.
        $categorySlug = trim((string) $request->query('category', ''));
        $active = $categorySlug !== '' ? $site->categories->firstWhere('slug', $categorySlug) : null;
        if ($active) {
            $ids = $this->categoryWithDescendants($site, $active->id);
            $posts = $posts->filter(
                fn (array $p) => collect($p['categories'])->pluck('id')->intersect($ids)->isNotEmpty()
            )->values();
        }

        // The block's own "number of posts" cap still applies before paging.
        if (($limit = (int) ($blockData['limit'] ?? 0)) > 0) {
            $posts = $posts->take($limit)->values();
        }

        $total = $posts->count();
        $pageCount = max(1, (int) ceil($total / $perPage));
        $pageNo = min(max(1, (int) $request->query('page', 1)), $pageCount);

        return [
            $posts->slice(($pageNo - 1) * $perPage, $perPage)->values(),
            ['page' => $pageNo, 'page_count' => $pageCount, 'total' => $total, 'category' => $active?->slug],
        ];
    }

    /** The category's id plus all of its descendants' ids. @return list<int> */
    private function categoryWithDescendants(Site $site, int $id): array
    {
        $ids = [$id];
        $added = true;
        while ($added) {
            $added = false;
            foreach ($site->categories as $c) {
                if ($c->parent_id !== null && in_array($c->parent_id, $ids, true) && ! in_array($c->id, $ids, true)) {
                    $ids[] = $c->id;
                    $added = true;
                }
            }
        }

        return $ids;
    }

    /** The first block of `$type` on the page (nested grids included), or null. */
    private function firstBlockData(SitePage $page, string $type): ?array
    {
        $find = function (array $blocks) use (&$find, $type): ?array {
            foreach ($blocks as $block) {
                if (($block['type'] ?? null) === $type) {
                    return is_array($block['data'] ?? null) ? $block['data'] : [];
                }
                foreach ($block['children'] ?? [] as $column) {
                    if (is_array($column) && ! is_null($found = $find($column))) {
                        return $found;
                    }
                }
            }

            return null;
        };

        return $find($page->blocks ?? []);
    }

    /** Record a page view for built-in analytics (see SiteVisits — deferred,
     *  bot-filtered, and also invoked by the full-page cache on hits). */
    private function recordVisit(Site $site, string $path, Request $request): void
    {
        if ($request->attributes->get('site_preview')) {
            return; // draft previews aren't traffic
        }

        SiteVisits::record($site->id, $site->studio_id, $path, $request);
    }

    /** Resolve a redirect target for a requested path segment, or null. */
    private function matchRedirect(Site $site, string $path): ?string
    {
        foreach ($site->redirects ?? [] as $r) {
            $from = ltrim((string) ($r['from'] ?? ''), '/');
            if ($from !== '' && $from === ltrim($path, '/')) {
                $to = (string) ($r['to'] ?? '');

                return preg_match('#^https?://#i', $to) || str_starts_with($to, '/')
                    ? $to
                    : $this->siteUrl($site, $to);
            }
        }

        return null;
    }

    /** A single published blog post (a child page of the blog page). */
    public function showPost(Request $request, string $slug, string $parent, string $post): Response
    {
        return $this->renderPost($request, $this->resolvePublished($slug), $parent, $post);
    }

    private function renderPost(Request $request, Site $site, string $parent, string $post): Response
    {
        $blog = $site->pages->first(fn (SitePage $p) => $p->is_blog && $p->slug === $parent);
        abort_if(! $blog, 404);

        $entry = $site->pages->first(fn (SitePage $p) => $p->parent_id === $blog->id
            && $p->slug === $post
            && $this->isLive($p));
        abort_if(! $entry, 404);

        $this->recordVisit($site, "{$parent}/{$post}", $request);

        // The post header is a regular `post_header` block at the top of the post.
        // Posts created before that (their header used to be auto-injected) get one
        // seeded here from the legacy shared design on the parent blog page, so they
        // keep their look until the studio re-saves them in the builder.
        $blocks = $this->withPostHeaderBlock($entry->blocks ?? [], $blog->header);

        // As in pageResponse: only ship what this post's blocks reference (the
        // post header's own categories come via the `post` prop below).
        $needsPosts = $this->hasBlockType($entry, 'blog');

        return Inertia::render('Sites/Public', [
            'site' => $this->siteProps($site, $entry, $entry->title),
            'studio_logo' => $site->headerLogoUrl(),
            'pages' => $this->topNav($site),
            'posts' => $needsPosts ? $this->postCards($site) : collect(),
            'categories' => $needsPosts ? $this->siteCategories($site) : collect(),
            'packages' => $this->hasBlockType($entry, 'packages') ? $this->packageCards($site) : collect(),
            // Keep the blog page highlighted in the nav while viewing a post.
            'page' => [
                'title' => $entry->title,
                'slug' => $blog->slug,
                'blocks' => $blocks,
                'head_code' => $entry->head_code,
                'body_code' => $entry->body_code,
                'og_image' => $entry->og_image ?: $entry->cover_image,
                'canonical' => $this->siteUrl($site, "{$blog->slug}/{$entry->slug}"),
            ],
            // Up to 3 other live posts sharing a category (else the latest).
            'related_posts' => $this->relatedPosts($site, $blog, $entry),
            // Drives the auto-generated post header (hero cover + date + categories).
            'post' => [
                'title' => $entry->title,
                'author' => $entry->author,
                'reading_minutes' => $this->readingMinutes($entry),
                'cover_image' => $entry->cover_image,
                'cover_focal' => $entry->cover_focal,
                'published_at' => $entry->published_at?->toDateString(),
                'categories' => collect($entry->category_ids ?? [])
                    ->map(fn ($id) => $site->categories->firstWhere('id', (int) $id))
                    ->filter()
                    ->map(fn (SiteCategory $c) => $this->categoryProps($c))
                    ->values(),
            ],
        ]);
    }

    /** sitemap.xml for a published site (home + top pages + published posts). */
    public function sitemap(string $slug): \Illuminate\Http\Response
    {
        return $this->renderSitemap($this->resolvePublished($slug, ['pages']));
    }

    private function renderSitemap(Site $site): \Illuminate\Http\Response
    {
        $urls = [];

        foreach ($site->pages->whereNull('parent_id') as $p) {
            $urls[] = [
                'loc' => $p->is_home ? $this->siteUrl($site) : $this->siteUrl($site, $p->slug),
                'lastmod' => $p->updated_at,
            ];
        }

        $blog = $site->blogPage();
        if ($blog) {
            foreach ($site->pages->where('parent_id', $blog->id)->filter(fn (SitePage $p) => $this->isLive($p)) as $p) {
                $urls[] = [
                    'loc' => $this->siteUrl($site, "{$blog->slug}/{$p->slug}"),
                    // Posts advertise their publish date when it's the later of the two.
                    'lastmod' => $p->published_at?->gt($p->updated_at ?? $p->published_at) ? $p->published_at : $p->updated_at,
                ];
            }
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'
            .'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            .collect($urls)->map(fn ($u) => '<url><loc>'.e($u['loc']).'</loc>'
                .($u['lastmod'] ? '<lastmod>'.$u['lastmod']->toDateString().'</lastmod>' : '')
                .'</url>')->implode('')
            .'</urlset>';

        return response($xml, 200, ['Content-Type' => 'application/xml']);
    }

    /** RSS 2.0 feed of the site's published blog posts. */
    public function feed(string $slug): \Illuminate\Http\Response
    {
        $site = $this->resolvePublished($slug, ['pages']);
        $blog = $site->blogPage();

        $posts = $blog
            ? $site->pages
                ->where('parent_id', $blog->id)
                ->filter(fn (SitePage $p) => $this->isLive($p))
                ->sortByDesc(fn (SitePage $p) => $p->published_at)
                ->take(20)
            : collect();

        $items = $posts->map(function (SitePage $p) use ($site, $blog) {
            $url = $this->siteUrl($site, "{$blog->slug}/{$p->slug}");

            return '<item>'
                .'<title>'.e($p->title).'</title>'
                .'<link>'.e($url).'</link>'
                .'<guid isPermaLink="true">'.e($url).'</guid>'
                .($p->published_at ? '<pubDate>'.$p->published_at->toRssString().'</pubDate>' : '')
                .($p->excerpt ? '<description>'.e($p->excerpt).'</description>' : '')
                .'</item>';
        })->implode('');

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'
            .'<rss version="2.0"><channel>'
            .'<title>'.e($site->name).'</title>'
            .'<link>'.e($this->siteUrl($site)).'</link>'
            .'<description>'.e($site->seo_description ?: $site->name).'</description>'
            .$items
            .'</channel></rss>';

        return response($xml, 200, ['Content-Type' => 'application/rss+xml; charset=UTF-8']);
    }

    /** robots.txt pointing at the site's sitemap. */
    public function robots(string $slug): \Illuminate\Http\Response
    {
        return $this->renderRobots($this->resolvePublished($slug, []));
    }

    private function renderRobots(Site $site): \Illuminate\Http\Response
    {
        $body = "User-agent: *\nAllow: /\nSitemap: ".$this->siteUrl($site, 'sitemap.xml')."\n";

        return response($body, 200, ['Content-Type' => 'text/plain']);
    }

    /**
     * A contact-form submission. Logs a SiteLead and fans out into a CRM
     * Contact + Project (a "Lead"), reusing an existing contact by email.
     */
    /** Newsletter block signup — a lightweight JSON endpoint (throttled). */
    public function subscribe(Request $request, string $slug): JsonResponse
    {
        $site = $this->resolvePublished($slug, []);

        // Same honeypot as the contact form: bots that fill it get a fake OK.
        if (filled($request->input('company_website'))) {
            return response()->json(['ok' => true]);
        }

        $data = $request->validate([
            'email' => 'required|email|max:255',
            'name' => 'nullable|string|max:255',
            'source' => 'nullable|string|max:250',
        ]);

        app()->instance('current.studio.id', $site->studio_id);

        SiteSubscriber::firstOrCreate(
            ['site_id' => $site->id, 'email' => mb_strtolower(trim($data['email']))],
            ['name' => $data['name'] ?? null, 'source' => $data['source'] ?? null],
        );

        return response()->json(['ok' => true]);
    }

    public function submitLead(Request $request, string $slug): RedirectResponse
    {
        // Pages are needed for the contact block's autoresponder config; the
        // studio for the notification email. Categories aren't used here.
        return $this->processLead($request, $this->resolvePublished($slug, ['pages', 'studio']));
    }

    private function processLead(Request $request, Site $site): RedirectResponse
    {
        // Honeypot: a hidden field real visitors never see. If a bot fills it,
        // pretend success and drop the submission silently.
        if (filled($request->input('company_website'))) {
            return back()->with('success', "Thanks — your enquiry has been sent. We'll be in touch soon!");
        }

        // Cloudflare Turnstile — verified server-side when the saved contact
        // block opts in (config comes from the block, never the request).
        $block = $this->contactBlockData($site);
        $turnstileSecret = $site->turnstileKeys()['secret'];
        if (! empty($block['captcha']) && $turnstileSecret) {
            $ok = false;
            try {
                $ok = Http::asForm()
                    ->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
                        'secret' => $turnstileSecret,
                        'response' => (string) $request->input('cf-turnstile-response'),
                        'remoteip' => $request->ip(),
                    ])->json('success') === true;
            } catch (\Throwable $e) {
                report($e);
            }
            if (! $ok) {
                return back()->withErrors(['captcha' => 'Please complete the verification and try again.']);
            }
        }

        // Public route: no authenticated studio. Bind the site's studio so the
        // BelongsToStudio scope + auto studio_id assignment work as normal.
        app()->instance('current.studio.id', $site->studio_id);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'phone' => 'nullable|string|max:50',
            'event_date' => 'nullable|date',
            'event_type' => 'nullable|string|max:120',
            'message' => 'nullable|string|max:5000',
            'custom_values' => 'array|max:30',
            'custom_values.*.label' => 'nullable|string|max:200',
            'custom_values.*.value' => 'nullable|string|max:5000',
            'attachment' => 'nullable|file|max:10240|mimes:pdf,jpg,jpeg,png,webp,doc,docx',
            // NOTE: the autoresponder settings are deliberately NOT accepted from
            // the request — they're read from the saved contact block server-side
            // (see contactBlockData), otherwise anyone could POST arbitrary
            // subject/body/recipient and use the platform as an email relay.
        ]);

        // Stash an uploaded attachment PRIVATELY (outside the public/ prefix, so
        // it's never CDN/anonymously reachable — visitor uploads shouldn't become
        // hosted files on the studio's trusted domain). The Leads screen serves
        // it via a short-lived signed URL.
        $attachmentPath = null;
        $attachmentName = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $attachmentPath = $file->store("studios/{$site->studio_id}/leads/attachments", 'wasabi');
            $attachmentName = $file->getClientOriginalName();
        }
        unset($data['attachment']);
        $data['attachment_path'] = $attachmentPath;
        $data['attachment_name'] = $attachmentName;

        // Compose CRM notes from the message + any custom field answers + attachment.
        $noteLines = [];
        if (! empty($data['message'])) {
            $noteLines[] = $data['message'];
        }
        foreach ($data['custom_values'] ?? [] as $cv) {
            if (! empty($cv['label']) && ($cv['value'] ?? '') !== '') {
                $noteLines[] = "{$cv['label']}: {$cv['value']}";
            }
        }
        if ($attachmentPath) {
            // No raw link — the file is private; it's viewable from Website → Leads.
            $noteLines[] = 'Attachment: '.($attachmentName ?: 'file').' (view it under Website → Leads)';
        }
        $notes = $noteLines ? implode("\n", $noteLines) : null;

        [$contact, $project] = DB::transaction(function () use ($site, $data, $notes) {
            [$first, $last] = $this->splitName($data['name']);

            $contact = Contact::where('email', $data['email'])->first();
            if (! $contact) {
                $contact = Contact::create([
                    'first_name' => $first,
                    'last_name' => $last,
                    'email' => $data['email'],
                    'phone' => $data['phone'] ?? null,
                    'notes' => 'Created from website enquiry.',
                ]);
            } elseif (! $contact->phone && ! empty($data['phone'])) {
                $contact->update(['phone' => $data['phone']]);
            }

            // A project (a CRM "Lead") is created automatically unless the studio
            // has turned that off in the site settings.
            $project = null;
            if ($site->auto_create_project) {
                // Lazily seed the studio's project statuses/types if they've never
                // opened the Projects module.
                if (ProjectStatus::count() === 0) {
                    ProjectStatus::seedDefaults();
                }
                if (ProjectType::count() === 0) {
                    ProjectType::seedDefaults();
                }

                $leadStatus = ProjectStatus::where('label', 'Lead')->first()
                    ?? ProjectStatus::orderBy('position')->first();
                $type = ! empty($data['event_type'])
                    ? ProjectType::where('label', $data['event_type'])->first()
                    : null;

                $name = ! empty($data['event_type'])
                    ? "{$data['event_type']} — {$contact->name}"
                    : "Website enquiry — {$contact->name}";

                $project = Project::create([
                    'name' => $name,
                    'contact_id' => $contact->id,
                    'status_id' => $leadStatus?->id,
                    'type_id' => $type?->id,
                    'event_date' => $data['event_date'] ?? null,
                    'notes' => $notes,
                    'position' => (int) Project::where('status_id', $leadStatus?->id)->max('position') + 1,
                ]);
            }

            SiteLead::create([
                'site_id' => $site->id,
                'contact_id' => $contact->id,
                'project_id' => $project?->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'event_date' => $data['event_date'] ?? null,
                'event_type' => $data['event_type'] ?? null,
                'message' => $data['message'] ?? null,
                'payload' => $data,
            ]);

            return [$contact, $project];
        });

        $this->notifyStudioOfLead($site, $data, $contact, $project);
        $this->sendLeadEmails($site, $data, $contact);

        return back()->with('success', "Thanks — your enquiry has been sent. We'll be in touch soon!");
    }

    /**
     * Raise an in-app (bell) notification for every studio user, pointing at the
     * new project (or the contact, when auto-create-project is off).
     *
     * @param  array<string, mixed>  $data
     */
    private function notifyStudioOfLead(Site $site, array $data, Contact $contact, ?Project $project): void
    {
        $users = User::where('studio_id', $site->studio_id)->get();
        if ($users->isEmpty()) {
            return;
        }

        $url = $project
            ? route('projects.index', ['open' => $project->id])
            : route('contacts.show', $contact->id);

        $preview = trim((string) ($data['message'] ?? ''));
        if ($preview === '') {
            $preview = $data['event_type'] ? "{$data['event_type']} enquiry" : 'New website enquiry';
        }

        Notification::send($users, new NewLead(
            fromName: $data['name'],
            subject: $data['event_type'] ? "{$data['event_type']} enquiry" : 'Website enquiry',
            preview: str($preview)->limit(140)->value(),
            url: $url,
        ));
    }

    /**
     * Notify the studio of a new enquiry and, if the form opted in, send the
     * enquirer an autoresponder. Email failures never break the submission.
     *
     * @param  array<string, mixed>  $data
     */
    private function sendLeadEmails(Site $site, array $data, Contact $contact): void
    {
        $studio = $site->studio;
        $studioName = $studio?->name ?: config('app.name');

        // ── Notify the studio ──
        if ($studio?->email) {
            try {
                $details = array_values(array_filter([
                    ['label' => 'Name', 'value' => $data['name']],
                    ['label' => 'Email', 'value' => $data['email']],
                    $data['phone'] ?? null ? ['label' => 'Phone', 'value' => $data['phone']] : null,
                    $data['event_date'] ?? null ? ['label' => 'Event date', 'value' => $data['event_date']] : null,
                    $data['event_type'] ?? null ? ['label' => 'Event type', 'value' => $data['event_type']] : null,
                    $data['message'] ?? null ? ['label' => 'Message', 'value' => $data['message']] : null,
                ]));

                foreach ($data['custom_values'] ?? [] as $cv) {
                    if (! empty($cv['label']) && ($cv['value'] ?? '') !== '') {
                        $details[] = ['label' => $cv['label'], 'value' => $cv['value']];
                    }
                }
                if (! empty($data['attachment_path'])) {
                    // The file is private — name only; the CTA links into Leads.
                    $details[] = ['label' => 'Attachment', 'value' => $data['attachment_name'] ?: 'Attached file (view in Leads)'];
                }

                Mail::to($studio->email)->send(new ClientMessage(
                    studioName: $studioName,
                    subjectLine: "New website enquiry — {$data['name']}",
                    bodyText: "You've received a new enquiry from your website.",
                    ctaLabel: 'View in leads',
                    ctaUrl: route('website.leads'),
                    details: $details,
                    replyToEmail: $data['email'],
                    logoUrl: $studio?->logoUrl(),
                    logoHeight: $studio?->emailLogoHeight(),
                ));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        // ── Autoresponder to the enquirer ──
        // Config comes from the site's saved contact block — never the request.
        $block = $this->contactBlockData($site);
        if (! empty($block['autoresponder']) && filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            try {
                $body = trim((string) ($block['autoresponder_message'] ?? '')) ?:
                    "Thanks for getting in touch — we've received your enquiry and will reply as soon as we can.";

                Mail::to($data['email'])->send(new ClientMessage(
                    studioName: $studioName,
                    subjectLine: trim((string) ($block['autoresponder_subject'] ?? '')) ?: 'Thanks for your enquiry',
                    bodyText: $body,
                    ctaLabel: 'Visit our website',
                    ctaUrl: $this->siteUrl($site),
                    replyToEmail: $studio?->email,
                    logoUrl: $studio?->logoUrl(),
                    logoHeight: $studio?->emailLogoHeight(),
                ));
            } catch (\Throwable $e) {
                report($e);
            }
        }
    }

    /**
     * The first contact block's saved data across the site's pages (nested grid
     * columns included). The autoresponder settings are read from here so the
     * public form can't be abused to send arbitrary email through the platform.
     *
     * @return array<string, mixed>|null
     */
    private function contactBlockData(Site $site): ?array
    {
        foreach ($site->pages as $page) {
            if (! is_null($found = $this->findContactBlock($page->blocks ?? []))) {
                return $found;
            }
        }

        return null;
    }

    /**
     * @param  array<int, mixed>  $blocks
     * @return array<string, mixed>|null
     */
    private function findContactBlock(array $blocks): ?array
    {
        foreach ($blocks as $block) {
            if (($block['type'] ?? null) === 'contact') {
                return is_array($block['data'] ?? null) ? $block['data'] : [];
            }
            foreach ($block['children'] ?? [] as $column) {
                if (is_array($column) && ! is_null($found = $this->findContactBlock($column))) {
                    return $found;
                }
            }
        }

        return null;
    }

    /** True when the page contains a block of `$type` (nested grids included). */
    private function hasBlockType(?SitePage $page, string $type): bool
    {
        return $page !== null && $this->blocksContain($page->blocks ?? [], $type);
    }

    /** @param  array<int, mixed>  $blocks */
    private function blocksContain(array $blocks, string $type): bool
    {
        foreach ($blocks as $block) {
            if (($block['type'] ?? null) === $type) {
                return true;
            }
            foreach ($block['children'] ?? [] as $column) {
                if (is_array($column) && $this->blocksContain($column, $type)) {
                    return true;
                }
            }
        }

        return false;
    }

    // ── Helpers ──

    /** @return array<string, mixed> */
    private function siteProps(Site $site, ?SitePage $current = null, ?string $seoTitleOverride = null): array
    {
        return [
            'name' => $site->name,
            'slug' => $site->slug,
            'base_path' => $this->basePath($site),
            'theme' => $site->themeSettings(),
            'header_nav' => $site->header_nav ?? [],
            'footer_nav' => $site->footer_nav ?? [],
            'head_code' => $site->head_code,
            'body_code' => $site->body_code,
            'custom_css' => $site->custom_css,
            'cookie_consent' => $site->cookie_consent,
            'cookie_message' => $site->cookie_message,
            'cookie_policy_url' => $site->cookie_policy_url,
            'favicon_url' => $site->favicon_url,
            'og_image_url' => $site->og_image_url,
            'seo_title' => $seoTitleOverride ?: ($current?->seo_title ?: $site->seo_title ?: $site->name),
            'seo_description' => $current?->seo_description ?: $site->seo_description,
            // RSS autodiscovery link (only when the site has a blog).
            'feed_url' => $site->blogPage() ? $this->siteUrl($site, 'feed') : null,
            'announcement' => $site->announcement ?? [],
            'social' => $site->social ?? [],
            'footer' => $site->footer ?? [],
            'footer_logo' => $site->footerLogoUrl(),
            // Cloudflare Turnstile site key (contact-form captcha), when configured.
            'turnstile_site_key' => $site->turnstileKeys()['site'],
            'noindex' => (bool) request()->attributes->get('site_preview'),
            // Booking block: the studio's public scheduling page (meetings module).
            'booking_url' => $site->studio?->slug ? route('meetings.public.studio', $site->studio->slug) : null,
            'custom_fonts' => $site->custom_fonts ?? [],
        ];
    }

    /** Top-level pages for the header/footer nav. */
    private function topNav(Site $site): Collection
    {
        return $site->pages->whereNull('parent_id')->map(fn (SitePage $p) => [
            'title' => $p->title,
            'slug' => $p->slug,
            'is_home' => $p->is_home,
        ])->values();
    }

    /** Active packages as cards for the `packages` block. */
    /** A single payment link rendered inside the studio's website (its shell). */
    public function paymentLink(Request $request, string $slug, string $package): Response
    {
        $site = $this->resolvePublished($slug, ['pages', 'studio']);
        $studio = $site->studio;

        $record = Package::withoutGlobalScopes()
            ->where('studio_id', $site->studio_id)->where('slug', $package)->where('active', true)
            ->firstOrFail();

        return Inertia::render('Sites/PaymentLink', [
            'site' => $this->siteProps($site),
            'studio_logo' => $site->headerLogoUrl(),
            'pages' => $this->topNav($site),
            'studio_slug' => $studio?->slug,
            'can_pay' => $studio?->stripe_connect_status === 'active',
            'package' => [
                'slug' => $record->slug,
                'name' => $record->name,
                'description' => $record->description,
                'details' => $record->details,
                'image_url' => $record->imageUrl(),
                'pricing_type' => $record->pricing_type,
                'price_cents' => $record->price_cents,
                'deposit_cents' => $record->offersDeposit() ? $record->deposit_cents : null,
                'min_amount_cents' => $record->min_amount_cents,
                'suggested_amount_cents' => $record->suggested_amount_cents,
                'currency' => $record->currency,
            ],
        ]);
    }

    private function packageCards(Site $site): Collection
    {
        return Package::withoutGlobalScopes()
            ->where('studio_id', $site->studio_id)
            ->where('active', true)
            ->orderBy('sort_order')->orderBy('name')
            ->get()
            ->map(fn (Package $p) => [
                'slug' => $p->slug,
                'name' => $p->name,
                'description' => $p->description,
                'image_url' => $p->imageUrl(),
                'price_cents' => $p->price_cents,
                'deposit_cents' => $p->offersDeposit() ? $p->deposit_cents : null,
                'currency' => $p->currency,
                // Each card opens its own payment page within the website (the
                // ResolveCustomDomain middleware maps this on custom domains too).
                'url' => $this->basePath($site).'/pay/'.$p->slug,
            ])->values();
    }

    /** Published posts under the blog page, as cards for the `blog` block. */
    private function postCards(Site $site): Collection
    {
        $blog = $site->blogPage();
        if (! $blog) {
            return collect();
        }

        $categoriesById = $site->categories->keyBy('id');

        return $site->pages
            ->where('parent_id', $blog->id)
            ->filter(fn (SitePage $p) => $this->isLive($p))
            ->sortByDesc(fn (SitePage $p) => $p->published_at)
            ->map(fn (SitePage $p) => [
                'title' => $p->title,
                'slug' => $p->slug,
                'excerpt' => $p->excerpt,
                'categories' => collect($p->category_ids ?? [])
                    ->map(fn ($id) => $categoriesById->get((int) $id))
                    ->filter()
                    ->map(fn (SiteCategory $c) => $this->categoryProps($c))
                    ->values(),
                'cover_image' => $p->cover_image,
                'published_at' => $p->published_at?->toDateString(),
                'url' => $this->basePath($site)."/{$blog->slug}/{$p->slug}",
            ])->values();
    }

    /**
     * The category tree for the blog block's filter, minus any the blog page has
     * hidden. Hiding a category just drops its filter link; posts keep it.
     */
    private function siteCategories(Site $site): Collection
    {
        $hidden = collect($site->blogPage()?->hidden_category_ids ?? [])->map(fn ($id) => (int) $id);

        return $site->categories
            ->reject(fn (SiteCategory $c) => $hidden->contains($c->id))
            ->map(fn (SiteCategory $c) => $this->categoryProps($c))
            ->values();
    }

    /** @return array{id:int,name:string,slug:string,parent_id:int|null} */
    private function categoryProps(SiteCategory $c): array
    {
        return ['id' => $c->id, 'name' => $c->name, 'slug' => $c->slug, 'parent_id' => $c->parent_id];
    }

    /** Estimated reading time from the post's text content (~200 wpm, min 1). */
    /**
     * Ensure a post's blocks open with a `post_header` block. Posts authored
     * before the header became a block get one prepended, seeded from the legacy
     * shared design ($seed) on the parent blog page so they render unchanged.
     *
     * @param  array<int, mixed>  $blocks
     * @param  mixed  $seed  The parent blog page's legacy `header` design (or null).
     * @return array<int, mixed>
     */
    private function withPostHeaderBlock(array $blocks, $seed): array
    {
        foreach ($blocks as $block) {
            if (($block['type'] ?? null) === 'post_header') {
                return $blocks;
            }
        }

        array_unshift($blocks, [
            'id' => 'post-header',
            'type' => 'post_header',
            'data' => is_array($seed) ? $seed : new \stdClass(),
        ]);

        return $blocks;
    }

    private function readingMinutes(SitePage $post): int
    {
        $words = 0;
        $walk = function (array $blocks) use (&$walk, &$words): void {
            foreach ($blocks as $block) {
                foreach (['body', 'heading', 'subheading', 'caption'] as $key) {
                    if (is_string($block['data'][$key] ?? null)) {
                        $words += str_word_count(strip_tags($block['data'][$key]));
                    }
                }
                foreach ($block['children'] ?? [] as $column) {
                    if (is_array($column)) {
                        $walk($column);
                    }
                }
            }
        };
        $walk($post->blocks ?? []);

        return max(1, (int) ceil($words / 200));
    }

    /**
     * Up to 3 other live posts, preferring shared categories, newest first.
     *
     * @return list<array<string, mixed>>
     */
    private function relatedPosts(Site $site, SitePage $blog, SitePage $current): array
    {
        $categoryIds = array_map('intval', $current->category_ids ?? []);

        $candidates = $site->pages
            ->where('parent_id', $blog->id)
            ->filter(fn (SitePage $p) => $p->id !== $current->id && $this->isLive($p))
            ->sortByDesc(fn (SitePage $p) => [
                // Shared-category posts first, then recency.
                count(array_intersect($categoryIds, array_map('intval', $p->category_ids ?? []))) > 0 ? 1 : 0,
                $p->published_at?->timestamp ?? 0,
            ])
            ->take(3);

        return $candidates->map(fn (SitePage $p) => [
            'title' => $p->title,
            'slug' => $p->slug,
            'excerpt' => $p->excerpt,
            'cover_image' => $p->cover_image,
            'published_at' => $p->published_at?->toDateString(),
            'url' => $this->basePath($site)."/{$blog->slug}/{$p->slug}",
        ])->values()->all();
    }

    private function isLive(SitePage $p): bool
    {
        return $p->status === 'published'
            && (is_null($p->published_at) || $p->published_at->lte(now()));
    }

    /**
     * @param  list<string>  $with  Relations the caller actually uses — pages
     *                              carry every block's JSON, so endpoints like
     *                              robots.txt shouldn't pay to load them.
     */
    private function resolvePublished(string $slug, array $with = ['pages', 'studio', 'categories']): Site
    {
        return Site::withoutGlobalScopes()
            ->with($with)
            ->where('slug', $slug)
            ->where('is_published', true)
            ->firstOrFail();
    }

    /** @return array{0: string, 1: ?string} */
    private function splitName(string $name): array
    {
        $parts = preg_split('/\s+/', trim($name), 2);

        return [$parts[0] ?? $name, $parts[1] ?? null];
    }
}
