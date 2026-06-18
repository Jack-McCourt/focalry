<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\ProjectType;
use App\Models\Site;
use App\Models\SiteLead;
use App\Models\SitePage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PublicSiteController extends Controller
{
    public function show(string $slug, ?string $page = null): Response
    {
        $site = $this->resolvePublished($slug);

        // Only top-level pages are reachable directly (posts live under the blog page).
        $top = $site->pages->whereNull('parent_id');
        $current = $page
            ? $top->firstWhere('slug', $page)
            : ($top->firstWhere('is_home', true) ?? $top->first());

        abort_if(! $current, 404);

        return Inertia::render('Sites/Public', [
            'site' => $this->siteProps($site, $current),
            'studio_logo' => $site->studio?->logoUrl(),
            'pages' => $this->topNav($site),
            'posts' => $this->postCards($site),
            'page' => [
                'title' => $current->title,
                'slug' => $current->slug,
                'blocks' => $current->blocks ?? [],
            ],
        ]);
    }

    /** A single published blog post (a child page of the blog page). */
    public function showPost(string $slug, string $parent, string $post): Response
    {
        $site = $this->resolvePublished($slug);

        $blog = $site->pages->first(fn (SitePage $p) => $p->is_blog && $p->slug === $parent);
        abort_if(! $blog, 404);

        $entry = $site->pages->first(fn (SitePage $p) => $p->parent_id === $blog->id
            && $p->slug === $post
            && $this->isLive($p));
        abort_if(! $entry, 404);

        return Inertia::render('Sites/Public', [
            'site' => $this->siteProps($site, $entry, $entry->title),
            'studio_logo' => $site->studio?->logoUrl(),
            'pages' => $this->topNav($site),
            'posts' => $this->postCards($site),
            // Keep the blog page highlighted in the nav while viewing a post.
            'page' => [
                'title' => $entry->title,
                'slug' => $blog->slug,
                'blocks' => $entry->blocks ?? [],
            ],
        ]);
    }

    /**
     * A contact-form submission. Logs a SiteLead and fans out into a CRM
     * Contact + Project (a "Lead"), reusing an existing contact by email.
     */
    public function submitLead(Request $request, string $slug): RedirectResponse
    {
        $site = $this->resolvePublished($slug);

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
        ]);

        DB::transaction(function () use ($site, $data) {
            [$first, $last] = $this->splitName($data['name']);

            $contact = Contact::where('email', $data['email'])->first();
            if (! $contact) {
                $contact = Contact::create([
                    'first_name' => $first,
                    'last_name' => $last,
                    'email' => $data['email'],
                    'phone' => $data['phone'] ?? null,
                    'status' => 'lead',
                    'notes' => 'Created from website enquiry.',
                ]);
            } elseif (! $contact->phone && ! empty($data['phone'])) {
                $contact->update(['phone' => $data['phone']]);
            }

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
                'notes' => $data['message'] ?? null,
                'position' => (int) Project::where('status_id', $leadStatus?->id)->max('position') + 1,
            ]);

            SiteLead::create([
                'site_id' => $site->id,
                'contact_id' => $contact->id,
                'project_id' => $project->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'event_date' => $data['event_date'] ?? null,
                'event_type' => $data['event_type'] ?? null,
                'message' => $data['message'] ?? null,
                'payload' => $data,
            ]);
        });

        return back()->with('success', "Thanks — your enquiry has been sent. We'll be in touch soon!");
    }

    // ── Helpers ──

    /** @return array<string, mixed> */
    private function siteProps(Site $site, ?SitePage $current = null, ?string $seoTitleOverride = null): array
    {
        return [
            'name' => $site->name,
            'slug' => $site->slug,
            'theme' => $site->themeSettings(),
            'header_nav' => $site->header_nav ?? [],
            'footer_nav' => $site->footer_nav ?? [],
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

    /** Published posts under the blog page, as cards for the `blog` block. */
    private function postCards(Site $site): Collection
    {
        $blog = $site->blogPage();
        if (! $blog) {
            return collect();
        }

        return $site->pages
            ->where('parent_id', $blog->id)
            ->filter(fn (SitePage $p) => $this->isLive($p))
            ->sortByDesc(fn (SitePage $p) => $p->published_at)
            ->map(fn (SitePage $p) => [
                'title' => $p->title,
                'slug' => $p->slug,
                'excerpt' => $p->excerpt,
                'cover_image' => $p->cover_image,
                'published_at' => $p->published_at?->toDateString(),
                'url' => "/site/{$site->slug}/{$blog->slug}/{$p->slug}",
            ])->values();
    }

    private function isLive(SitePage $p): bool
    {
        return $p->status === 'published'
            && (is_null($p->published_at) || $p->published_at->lte(now()));
    }

    private function resolvePublished(string $slug): Site
    {
        return Site::withoutGlobalScopes()
            ->with(['pages', 'studio'])
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
