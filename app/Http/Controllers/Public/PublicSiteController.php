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
use App\Models\SiteVisit;
use App\Models\User;
use App\Notifications\NewLead;
use App\Support\PublicAsset;
use App\Support\StudioPaths;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
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
        if ($host = $this->domainHost()) {
            return 'https://'.$host.($suffix !== '' ? '/'.$suffix : '');
        }

        return url('/site/'.$site->slug.($suffix !== '' ? '/'.$suffix : ''));
    }

    /** Root-relative base for in-page links ('' on a custom domain). */
    private function basePath(Site $site): string
    {
        return $this->domainHost() ? '' : '/site/'.$site->slug;
    }

    public function show(Request $request, string $slug, ?string $page = null)
    {
        return $this->renderPage($request, $this->resolvePublished($slug), $page);
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

        return $this->pageResponse($site, $current);
    }

    /** Build the Inertia page response for a resolved page. */
    private function pageResponse(Site $site, SitePage $current): Response
    {
        return Inertia::render('Sites/Public', [
            'site' => $this->siteProps($site, $current),
            'studio_logo' => $site->studio?->logoUrl(),
            'pages' => $this->topNav($site),
            'posts' => $this->postCards($site),
            'categories' => $this->siteCategories($site),
            'packages' => $this->packageCards($site),
            'page' => [
                'title' => $current->title,
                'slug' => $current->slug,
                'blocks' => $current->blocks ?? [],
                'head_code' => $current->head_code,
                'body_code' => $current->body_code,
                'og_image' => $current->og_image,
                'canonical' => $current->is_home ? $this->siteUrl($site) : $this->siteUrl($site, $current->slug),
            ],
        ]);
    }

    /** Record a page view (skipping obvious bots) for built-in analytics. */
    private function recordVisit(Site $site, string $path, Request $request): void
    {
        $ua = (string) $request->userAgent();
        if ($ua === '' || preg_match('/bot|crawl|spider|slurp|bing|facebookexternalhit|headless|preview|monitor/i', $ua)) {
            return;
        }

        app()->instance('current.studio.id', $site->studio_id);

        try {
            $ref = $request->headers->get('referer');
            $host = $ref ? parse_url($ref, PHP_URL_HOST) : null;
            // Ignore self-referrals (internal navigation).
            if ($host === $request->getHost()) {
                $host = null;
            }

            SiteVisit::create([
                'site_id' => $site->id,
                'path' => mb_substr($path !== '' ? $path : '/', 0, 250),
                'referrer_host' => $host ? mb_substr($host, 0, 250) : null,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
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

        return Inertia::render('Sites/Public', [
            'site' => $this->siteProps($site, $entry, $entry->title),
            'studio_logo' => $site->studio?->logoUrl(),
            'pages' => $this->topNav($site),
            'posts' => $this->postCards($site),
            'categories' => $this->siteCategories($site),
            'packages' => $this->packageCards($site),
            // Keep the blog page highlighted in the nav while viewing a post.
            'page' => [
                'title' => $entry->title,
                'slug' => $blog->slug,
                'blocks' => $entry->blocks ?? [],
                'head_code' => $entry->head_code,
                'body_code' => $entry->body_code,
                'og_image' => $entry->og_image ?: $entry->cover_image,
                'canonical' => $this->siteUrl($site, "{$blog->slug}/{$entry->slug}"),
            ],
            // Drives the auto-generated post header (hero cover + date + categories).
            'post' => [
                'title' => $entry->title,
                'cover_image' => $entry->cover_image,
                'cover_focal' => $entry->cover_focal,
                // Header formatting is a single setting on the parent blog page,
                // shared by every post.
                'header' => $blog->header,
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
        return $this->renderSitemap($this->resolvePublished($slug));
    }

    private function renderSitemap(Site $site): \Illuminate\Http\Response
    {
        $urls = [];

        foreach ($site->pages->whereNull('parent_id') as $p) {
            $urls[] = $p->is_home ? $this->siteUrl($site) : $this->siteUrl($site, $p->slug);
        }

        $blog = $site->blogPage();
        if ($blog) {
            foreach ($site->pages->where('parent_id', $blog->id)->filter(fn (SitePage $p) => $this->isLive($p)) as $p) {
                $urls[] = $this->siteUrl($site, "{$blog->slug}/{$p->slug}");
            }
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'
            .'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            .collect($urls)->map(fn ($u) => '<url><loc>'.e($u).'</loc></url>')->implode('')
            .'</urlset>';

        return response($xml, 200, ['Content-Type' => 'application/xml']);
    }

    /** robots.txt pointing at the site's sitemap. */
    public function robots(string $slug): \Illuminate\Http\Response
    {
        return $this->renderRobots($this->resolvePublished($slug));
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
    public function submitLead(Request $request, string $slug): RedirectResponse
    {
        return $this->processLead($request, $this->resolvePublished($slug));
    }

    private function processLead(Request $request, Site $site): RedirectResponse
    {
        // Honeypot: a hidden field real visitors never see. If a bot fills it,
        // pretend success and drop the submission silently.
        if (filled($request->input('company_website'))) {
            return back()->with('success', "Thanks — your enquiry has been sent. We'll be in touch soon!");
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
            'autoresponder' => 'boolean',
            'autoresponder_subject' => 'nullable|string|max:200',
            'autoresponder_message' => 'nullable|string|max:5000',
        ]);

        // Stash an uploaded attachment and replace the file object with its URL.
        $attachmentUrl = null;
        if ($request->hasFile('attachment')) {
            $path = $request->file('attachment')->storePublicly(StudioPaths::asset($site->studio_id, 'site/uploads'), 'wasabi');
            $attachmentUrl = PublicAsset::url($path);
        }
        unset($data['attachment']);
        $data['attachment_url'] = $attachmentUrl;

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
        if ($attachmentUrl) {
            $noteLines[] = "Attachment: {$attachmentUrl}";
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
                if (! empty($data['attachment_url'])) {
                    $details[] = ['label' => 'Attachment', 'value' => $data['attachment_url']];
                }

                Mail::to($studio->email)->send(new ClientMessage(
                    studioName: $studioName,
                    subjectLine: "New website enquiry — {$data['name']}",
                    bodyText: "You've received a new enquiry from your website.",
                    ctaLabel: 'View in leads',
                    ctaUrl: route('website.leads'),
                    details: $details,
                    replyToEmail: $data['email'],
                ));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        // ── Autoresponder to the enquirer ──
        if (! empty($data['autoresponder']) && filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            try {
                $body = trim((string) ($data['autoresponder_message'] ?? '')) ?:
                    "Thanks for getting in touch — we've received your enquiry and will reply as soon as we can.";

                Mail::to($data['email'])->send(new ClientMessage(
                    studioName: $studioName,
                    subjectLine: trim((string) ($data['autoresponder_subject'] ?? '')) ?: 'Thanks for your enquiry',
                    bodyText: $body,
                    ctaLabel: 'Visit our website',
                    ctaUrl: $this->siteUrl($site),
                    replyToEmail: $studio?->email,
                ));
            } catch (\Throwable $e) {
                report($e);
            }
        }
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
        $site = $this->resolvePublished($slug);
        $studio = $site->studio;

        $record = Package::withoutGlobalScopes()
            ->where('studio_id', $site->studio_id)->where('slug', $package)->where('active', true)
            ->firstOrFail();

        return Inertia::render('Sites/PaymentLink', [
            'site' => $this->siteProps($site),
            'studio_logo' => $studio?->logoUrl(),
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

    private function isLive(SitePage $p): bool
    {
        return $p->status === 'published'
            && (is_null($p->published_at) || $p->published_at->lte(now()));
    }

    private function resolvePublished(string $slug): Site
    {
        return Site::withoutGlobalScopes()
            ->with(['pages', 'studio', 'categories'])
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
