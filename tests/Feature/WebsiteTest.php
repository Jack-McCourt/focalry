<?php

use App\Jobs\ImportSiteImage;
use App\Mail\ClientMessage;
use App\Models\Collection;
use App\Models\Contact;
use App\Models\Photo;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\Site;
use App\Models\SiteCategory;
use App\Models\SiteLead;
use App\Models\SitePage;
use App\Models\SiteSnapshot;
use App\Models\SiteSubscriber;
use App\Models\SiteVisit;
use App\Models\Studio;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

function publishedSite(Studio $studio): Site
{
    return Site::withoutGlobalScopes()->create([
        'studio_id' => $studio->id,
        'name' => 'Test Studio',
        'slug' => 'test-studio',
        'template' => 'portfolio',
        'is_published' => true,
        'published_at' => now(),
    ]);
}

it('seeds a multi-page starter site with managed nav on first visit', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();

    $this->actingAs($user)->get('/website')->assertOk();

    $site = Site::withoutGlobalScopes()->where('studio_id', $studio->id)->first();
    expect($site)->not->toBeNull()
        ->and($site->header_nav)->not->toBeEmpty()
        ->and($site->footer_nav)->not->toBeEmpty();

    $slugs = SitePage::withoutGlobalScopes()->where('site_id', $site->id)->whereNull('parent_id')->pluck('slug')->all();
    expect($slugs)->toContain('home', 'about', 'blog', 'contact');
});

it('seeds example blog posts as child pages of the blog page', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();

    $this->actingAs($user)->get('/website')->assertOk();

    $site = Site::withoutGlobalScopes()->where('studio_id', $studio->id)->first();
    $blog = SitePage::withoutGlobalScopes()->where('site_id', $site->id)->where('is_blog', true)->first();
    expect($blog)->not->toBeNull();

    $posts = SitePage::withoutGlobalScopes()->where('parent_id', $blog->id)->get();
    expect($posts)->toHaveCount(2)
        ->and($posts->every(fn ($p) => $p->status === 'published'))->toBeTrue();
});

it('creates a contact, project lead and lead log from a website enquiry', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);

    $this->post("/site/{$site->slug}/contact", [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'phone' => '555-1234',
        'event_type' => 'Wedding',
        'event_date' => '2026-09-01',
        'message' => 'We would love a quote.',
    ])->assertRedirect();

    $this->assertDatabaseHas('contacts', [
        'email' => 'jane@example.com',
        'studio_id' => $studio->id,
    ]);
    $this->assertDatabaseHas('site_leads', [
        'email' => 'jane@example.com',
        'studio_id' => $studio->id,
        'site_id' => $site->id,
    ]);

    $contact = Contact::withoutGlobalScopes()->where('email', 'jane@example.com')->first();
    $project = Project::withoutGlobalScopes()->where('contact_id', $contact->id)->first();
    $leadStatus = ProjectStatus::withoutGlobalScopes()
        ->where('studio_id', $studio->id)->where('label', 'Lead')->first();

    expect($project)->not->toBeNull()
        ->and($project->status_id)->toBe($leadStatus->id)
        ->and($contact->first_name)->toBe('Jane')
        ->and($contact->last_name)->toBe('Doe');
});

it('skips automatic project creation when the site has it turned off', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);
    $site->update(['auto_create_project' => false]);

    $this->post("/site/{$site->slug}/contact", [
        'name' => 'No Project',
        'email' => 'noproj@example.com',
        'message' => 'Just a question.',
    ])->assertRedirect();

    // Contact + lead are still recorded; only the project is skipped.
    $contact = Contact::withoutGlobalScopes()->where('email', 'noproj@example.com')->first();
    expect($contact)->not->toBeNull()
        ->and(Project::withoutGlobalScopes()->where('contact_id', $contact->id)->exists())->toBeFalse();
    $this->assertDatabaseHas('site_leads', ['email' => 'noproj@example.com', 'project_id' => null]);
});

it('raises an in-app notification for studio users on a new enquiry', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();
    $site = publishedSite($studio);

    $this->post("/site/{$site->slug}/contact", [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'event_type' => 'Wedding',
        'message' => 'We would love a quote.',
    ])->assertRedirect();

    $notification = $user->fresh()->notifications()->first();
    expect($notification)->not->toBeNull()
        ->and($notification->data['type'])->toBe('lead')
        ->and($notification->data['title'])->toContain('Jane Doe')
        ->and($notification->data['url'])->not->toBeNull();
});

it('drops a honeypot submission without creating a lead', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);

    $this->post("/site/{$site->slug}/contact", [
        'name' => 'Spam Bot',
        'email' => 'bot@example.com',
        'company_website' => 'http://spam.example',
    ])->assertRedirect();

    $this->assertDatabaseMissing('contacts', ['email' => 'bot@example.com']);
    $this->assertDatabaseMissing('site_leads', ['email' => 'bot@example.com']);
});

it('emails the studio on a new lead and an autoresponder when the contact block opts in', function () {
    Mail::fake();
    $studio = Studio::factory()->onPaidPlan()->create(['email' => 'studio@example.com']);
    $site = publishedSite($studio);

    // The autoresponder config lives on the saved contact block, not the request.
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id,
        'site_id' => $site->id,
        'title' => 'Contact',
        'slug' => 'contact',
        'blocks' => [[
            'id' => 'b1',
            'type' => 'contact',
            'data' => ['autoresponder' => true, 'autoresponder_subject' => 'Got it!', 'autoresponder_message' => 'Thanks Jane.'],
        ]],
    ]);

    $this->post("/site/{$site->slug}/contact", [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
    ])->assertRedirect();

    Mail::assertSent(ClientMessage::class, fn ($m) => $m->hasTo('studio@example.com'));
    Mail::assertSent(ClientMessage::class, fn ($m) => $m->hasTo('jane@example.com'));
});

it('ignores autoresponder fields sent by the client (no open email relay)', function () {
    Mail::fake();
    $studio = Studio::factory()->onPaidPlan()->create(['email' => 'studio@example.com']);
    $site = publishedSite($studio);

    // An attacker POSTing autoresponder content must not get an email sent to
    // the target address — the site has no contact block opting in.
    $this->post("/site/{$site->slug}/contact", [
        'name' => 'Jane Doe',
        'email' => 'victim@example.com',
        'autoresponder' => true,
        'autoresponder_subject' => 'Your account is locked',
        'autoresponder_message' => 'Click here: https://evil.example',
    ])->assertRedirect();

    Mail::assertSent(ClientMessage::class, fn ($m) => $m->hasTo('studio@example.com'));
    Mail::assertNotSent(ClientMessage::class, fn ($m) => $m->hasTo('victim@example.com'));
});

it('captures custom fields and a file attachment on a lead', function () {
    Storage::fake('wasabi');
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);

    $this->post("/site/{$site->slug}/contact", [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'message' => 'Hello',
        'custom_values' => [['label' => 'Venue', 'value' => 'The Barn']],
        'attachment' => UploadedFile::fake()->create('brief.pdf', 20, 'application/pdf'),
    ])->assertRedirect();

    $lead = SiteLead::withoutGlobalScopes()->where('email', 'jane@example.com')->first();
    expect($lead->payload['custom_values'][0]['value'])->toBe('The Barn')
        ->and($lead->payload['attachment_path'])->not->toBeNull()
        // Stored PRIVATELY — outside the public/ (CDN-served) prefix, so visitor
        // uploads never become anonymously-hosted files on the studio's domain.
        ->and($lead->payload['attachment_path'])->not->toStartWith('public/')
        ->and($lead->payload['attachment_name'])->toBe('brief.pdf');

    $project = Project::withoutGlobalScopes()->where('contact_id', $lead->contact_id)->first();
    expect($project->notes)->toContain('Venue: The Barn')->toContain('Attachment: brief.pdf');
    expect(Storage::disk('wasabi')->allFiles())->not->toBeEmpty();
});

it('reuses an existing contact by email instead of duplicating', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);

    $existing = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id,
        'first_name' => 'Repeat',
        'email' => 'repeat@example.com',
    ]);

    $this->post("/site/{$site->slug}/contact", [
        'name' => 'Repeat Client',
        'email' => 'repeat@example.com',
        'message' => 'Hi again',
    ])->assertRedirect();

    expect(Contact::withoutGlobalScopes()->where('email', 'repeat@example.com')->count())->toBe(1);
    $lead = SiteLead::withoutGlobalScopes()->where('email', 'repeat@example.com')->first();
    expect($lead->contact_id)->toBe($existing->id);
});

it('301-redirects a configured old path', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);
    $site->update(['redirects' => [['from' => 'old-about', 'to' => 'about']]]);
    $site->pages()->create(['studio_id' => $studio->id, 'title' => 'Home', 'slug' => 'home', 'is_home' => true, 'blocks' => []]);

    $this->get("/site/{$site->slug}/old-about")
        ->assertRedirect(url("/site/{$site->slug}/about"));
});

it('renders a custom 404 page for unknown URLs', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);
    $site->pages()->create(['studio_id' => $studio->id, 'title' => 'Home', 'slug' => 'home', 'is_home' => true, 'blocks' => []]);
    $site->pages()->create(['studio_id' => $studio->id, 'title' => 'Not found', 'slug' => 'oops', 'is_404' => true, 'blocks' => []]);

    $this->get("/site/{$site->slug}/does-not-exist")->assertNotFound();
});

it('records a page view for analytics but skips bots', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);
    $site->pages()->create(['studio_id' => $studio->id, 'title' => 'Home', 'slug' => 'home', 'is_home' => true, 'blocks' => []]);

    $this->withHeaders(['User-Agent' => 'Mozilla/5.0 (real human)'])->get("/site/{$site->slug}")->assertOk();
    $this->withHeaders(['User-Agent' => 'Googlebot/2.1'])->get("/site/{$site->slug}")->assertOk();

    expect(SiteVisit::withoutGlobalScopes()->where('site_id', $site->id)->count())->toBe(1);
});

it('serves sitemap.xml and robots.txt for a published site', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);
    $site->pages()->create(['studio_id' => $studio->id, 'title' => 'Home', 'slug' => 'home', 'is_home' => true, 'blocks' => []]);
    $site->pages()->create(['studio_id' => $studio->id, 'title' => 'About', 'slug' => 'about', 'blocks' => []]);

    $sitemap = $this->get("/site/{$site->slug}/sitemap.xml");
    $sitemap->assertOk()->assertHeader('Content-Type', 'application/xml');
    expect($sitemap->getContent())->toContain(url("/site/{$site->slug}/about"))->toContain('<urlset');

    $robots = $this->get("/site/{$site->slug}/robots.txt");
    $robots->assertOk();
    expect($robots->getContent())->toContain('Sitemap: '.url("/site/{$site->slug}/sitemap.xml"));
});

it('does not expose an unpublished site', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = Site::withoutGlobalScopes()->create([
        'studio_id' => $studio->id,
        'name' => 'Hidden',
        'slug' => 'hidden-studio',
        'template' => 'portfolio',
        'is_published' => false,
    ]);

    $this->get("/site/{$site->slug}")->assertNotFound();
    $this->post("/site/{$site->slug}/contact", [
        'name' => 'Jane',
        'email' => 'jane@example.com',
    ])->assertNotFound();
});

it('shows a published post and hides drafts (posts are child pages)', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);

    $blog = SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'title' => 'Blog', 'slug' => 'blog', 'is_blog' => true, 'blocks' => [],
    ]);
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id, 'parent_id' => $blog->id,
        'title' => 'Hello World', 'slug' => 'hello-world', 'status' => 'published', 'published_at' => now(), 'blocks' => [],
    ]);
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id, 'parent_id' => $blog->id,
        'title' => 'Secret Draft', 'slug' => 'secret-draft', 'status' => 'draft', 'blocks' => [],
    ]);

    $this->get("/site/{$site->slug}/blog/hello-world")->assertOk();
    $this->get("/site/{$site->slug}/blog/secret-draft")->assertNotFound();
});

it('prepends a post_header block to a legacy post, seeded from the blog page design', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);

    // A blog page carrying the legacy shared header design, and a post with no
    // post_header block (as authored before the header became a block).
    $blog = SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'title' => 'Blog', 'slug' => 'blog', 'is_blog' => true, 'blocks' => [],
        'header' => ['overlay' => 55, 'title_size' => 'xl'],
    ]);
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id, 'parent_id' => $blog->id,
        'title' => 'Legacy', 'slug' => 'legacy', 'status' => 'published', 'published_at' => now(),
        'blocks' => [['id' => 'b1', 'type' => 'text', 'data' => ['body' => 'Hello']]],
    ]);

    $this->get("/site/{$site->slug}/blog/legacy")->assertInertia(fn (AssertableInertia $page) => $page
        // The header is now the first block, seeded from the blog page's design…
        ->where('page.blocks.0.type', 'post_header')
        ->where('page.blocks.0.data.overlay', 55)
        ->where('page.blocks.0.data.title_size', 'xl')
        // …and the original body block follows it.
        ->where('page.blocks.1.type', 'text'));
});

it('does not add a second post_header when the post already has one', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);

    $blog = SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'title' => 'Blog', 'slug' => 'blog', 'is_blog' => true, 'blocks' => [],
        'header' => ['overlay' => 55],
    ]);
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id, 'parent_id' => $blog->id,
        'title' => 'Modern', 'slug' => 'modern', 'status' => 'published', 'published_at' => now(),
        'blocks' => [
            ['id' => 'h1', 'type' => 'post_header', 'data' => ['overlay' => 10]],
            ['id' => 'b1', 'type' => 'text', 'data' => ['body' => 'Hello']],
        ],
    ]);

    $this->get("/site/{$site->slug}/blog/modern")->assertInertia(fn (AssertableInertia $page) => $page
        ->count('page.blocks', 2)
        // The post's own header is kept verbatim — not reseeded from the blog page.
        ->where('page.blocks.0.data.overlay', 10));
});

it('saves a blog post as a child of the blog page via the builder', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();
    $this->actingAs($user)->get('/website')->assertOk();

    $this->actingAs($user)->put(route('website.update'), [
        'name' => 'My Studio',
        'slug' => 'my-studio-saved',
        'theme' => ['primary_color' => '#111111', 'font' => 'sans'],
        'header_nav' => [],
        'footer_nav' => [],
        'pages' => [
            ['title' => 'Home', 'slug' => 'home', 'is_home' => true, 'is_blog' => false, 'is_post' => false, 'blocks' => []],
            ['title' => 'Blog', 'slug' => 'blog', 'is_home' => false, 'is_blog' => true, 'is_post' => false, 'blocks' => []],
            ['title' => 'My Post', 'slug' => 'my-post', 'is_post' => true, 'status' => 'published', 'blocks' => []],
        ],
    ])->assertRedirect();

    // The save lands in the draft — nothing hits the live pages until Publish.
    $site = Site::withoutGlobalScopes()->where('studio_id', $studio->id)->first();
    expect($site->draft)->not->toBeNull()
        ->and(SitePage::withoutGlobalScopes()->where('site_id', $site->id)->where('slug', 'my-post')->exists())->toBeFalse();

    $this->actingAs($user)->post(route('website.publish'), ['publish' => true])->assertRedirect();

    $site->refresh();
    $blog = SitePage::withoutGlobalScopes()->where('site_id', $site->id)->where('is_blog', true)->first();
    $post = SitePage::withoutGlobalScopes()->where('site_id', $site->id)->where('slug', 'my-post')->first();

    expect($site->draft)->toBeNull()
        ->and($post->parent_id)->toBe($blog->id)
        ->and($post->status)->toBe('published')
        ->and($post->published_at)->not->toBeNull();
});

it('persists nested grid blocks and per-block style settings through a save', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();
    $this->actingAs($user)->get('/website')->assertOk();

    $grid = [
        'id' => 'grid-1', 'type' => 'grid', 'data' => ['columns' => 2, 'gap' => 'md'],
        'settings' => ['background' => '#f5f5f5'],
        'children' => [
            [['id' => 'c1', 'type' => 'text', 'data' => ['heading' => 'Hi', 'body' => 'x'], 'settings' => ['text_size' => 'lg']]],
            [['id' => 'c2', 'type' => 'image', 'data' => ['image_url' => '']]],
        ],
    ];

    $this->actingAs($user)->put(route('website.update'), [
        'name' => 'My Studio',
        'slug' => 'grid-site',
        'theme' => ['primary_color' => '#111111', 'font' => 'sans'],
        'header_nav' => [],
        'footer_nav' => [],
        'pages' => [
            ['title' => 'Home', 'slug' => 'home', 'is_home' => true, 'is_blog' => false, 'is_post' => false, 'blocks' => [$grid]],
        ],
    ])->assertRedirect();

    $this->actingAs($user)->post(route('website.publish'), ['publish' => true])->assertRedirect();

    $site = Site::withoutGlobalScopes()->where('studio_id', $studio->id)->first();
    $home = SitePage::withoutGlobalScopes()->where('site_id', $site->id)->where('slug', 'home')->first();
    $blocks = $home->blocks;

    expect($blocks)->toHaveCount(1)
        ->and($blocks[0]['type'])->toBe('grid')
        ->and($blocks[0]['settings']['background'])->toBe('#f5f5f5')
        ->and($blocks[0]['children'])->toHaveCount(2)
        ->and($blocks[0]['children'][0][0]['type'])->toBe('text')
        ->and($blocks[0]['children'][0][0]['settings']['text_size'])->toBe('lg');
});

it('keeps builder edits in a draft until published, and can discard them', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();
    $this->actingAs($user)->get('/website')->assertOk();

    $site = Site::withoutGlobalScopes()->where('studio_id', $studio->id)->first();
    $liveName = $site->name;

    $this->actingAs($user)->put(route('website.update'), [
        'name' => 'Renamed In Draft',
        'slug' => $site->slug,
        'theme' => ['primary_color' => '#111111', 'font' => 'sans'],
        'header_nav' => [],
        'footer_nav' => [],
        'pages' => [
            ['title' => 'Home', 'slug' => 'home', 'is_home' => true, 'is_blog' => false, 'is_post' => false, 'blocks' => []],
        ],
    ])->assertRedirect();

    // Live record untouched; the builder reloads the draft state.
    $site->refresh();
    expect($site->name)->toBe($liveName)->and($site->draft)->not->toBeNull();
    $this->actingAs($user)->get('/website')->assertInertia(fn (AssertableInertia $page) => $page
        ->component('Website/Builder')
        ->where('site.name', 'Renamed In Draft')
        ->where('has_draft', true));

    // Discard: draft gone, builder back to the live values.
    $this->actingAs($user)->delete(route('website.draft.discard'))->assertRedirect();
    $site->refresh();
    expect($site->draft)->toBeNull()->and($site->name)->toBe($liveName);
});

it('serves published pages from the full-page cache, versioned on the site', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'title' => 'Home', 'slug' => 'home', 'is_home' => true, 'blocks' => [],
    ]);

    // First hit renders and caches; second is served from the cache.
    expect($this->get("/site/{$site->slug}")->assertOk()->headers->get('X-Page-Cache'))->toBeNull();
    expect($this->get("/site/{$site->slug}")->assertOk()->headers->get('X-Page-Cache'))->toBe('hit');

    // Touching the site (what Publish does) starts a fresh cache version.
    Site::withoutGlobalScopes()->whereKey($site->id)->update(['updated_at' => now()->addMinute()]);
    expect($this->get("/site/{$site->slug}")->assertOk()->headers->get('X-Page-Cache'))->toBeNull();
});

it('still counts page views served from the full-page cache', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'title' => 'Home', 'slug' => 'home', 'is_home' => true, 'blocks' => [],
    ]);

    $this->get("/site/{$site->slug}")->assertOk(); // miss — counted by the controller
    $this->get("/site/{$site->slug}")->assertOk(); // hit — counted by the middleware

    expect(SiteVisit::withoutGlobalScopes()->where('site_id', $site->id)->count())->toBe(2);
});

it('only ships posts, categories and packages to pages that use those blocks', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);

    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'title' => 'Home', 'slug' => 'home', 'is_home' => true, 'blocks' => [],
    ]);
    $blog = SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'title' => 'Journal', 'slug' => 'journal', 'is_blog' => true,
        'blocks' => [['id' => 'b1', 'type' => 'blog', 'data' => []]],
    ]);
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'parent_id' => $blog->id, 'title' => 'Post', 'slug' => 'post-1',
        'status' => 'published', 'published_at' => now(), 'blocks' => [],
    ]);

    // No blog/packages block on the home page → empty props despite a published post.
    $this->get("/site/{$site->slug}")->assertInertia(fn (AssertableInertia $page) => $page
        ->component('Sites/Public')->count('posts', 0)->count('categories', 0)->count('packages', 0));

    // The blog page uses a blog block → posts are included.
    $this->get("/site/{$site->slug}/journal")->assertInertia(fn (AssertableInertia $page) => $page
        ->component('Sites/Public')->count('posts', 1));
});

it('uses the studio\'s own Turnstile keys when set, falling back to the platform', function () {
    config(['services.turnstile.site_key' => 'platform-site', 'services.turnstile.secret_key' => 'platform-secret']);
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'title' => 'Home', 'slug' => 'home', 'is_home' => true, 'blocks' => [],
    ]);

    // Platform fallback.
    $this->get("/site/{$site->slug}")->assertInertia(fn (AssertableInertia $page) => $page
        ->where('site.turnstile_site_key', 'platform-site'));

    // Studio override (both halves required — never mix pairs).
    $site->update(['turnstile_site_key' => 'studio-site', 'turnstile_secret_key' => 'studio-secret']);
    expect($site->fresh()->turnstileKeys())->toBe(['site' => 'studio-site', 'secret' => 'studio-secret']);

    // Only one half set → fall back to the platform pair.
    $site->update(['turnstile_secret_key' => null]);
    expect($site->fresh()->turnstileKeys()['site'])->toBe('platform-site');
});

it('keeps publish snapshots and restores one into the draft', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();
    $this->actingAs($user)->get('/website')->assertOk();
    $site = Site::withoutGlobalScopes()->where('studio_id', $studio->id)->first();

    $payload = fn (string $name) => [
        'name' => $name, 'slug' => $site->slug,
        'theme' => ['primary_color' => '#111111', 'font' => 'sans'], 'header_nav' => [], 'footer_nav' => [],
        'pages' => [['title' => 'Home', 'slug' => 'home', 'is_home' => true, 'is_blog' => false, 'is_post' => false, 'blocks' => []]],
    ];

    // Two publishes → two snapshots (newest first).
    $this->actingAs($user)->put(route('website.update'), $payload('Version One'))->assertRedirect();
    $this->actingAs($user)->post(route('website.publish'), ['publish' => true])->assertRedirect();
    $this->actingAs($user)->put(route('website.update'), $payload('Version Two'))->assertRedirect();
    $this->actingAs($user)->post(route('website.publish'), ['publish' => true])->assertRedirect();

    $snapshots = SiteSnapshot::withoutGlobalScopes()->where('site_id', $site->id)->orderByDesc('id')->get();
    expect($snapshots)->toHaveCount(2)
        ->and($snapshots->first()->payload['name'])->toBe('Version Two');

    // Restore the older version → lands in the DRAFT, live untouched.
    $old = $snapshots->last();
    $this->actingAs($user)->post(route('website.snapshots.restore', $old->id))->assertRedirect(route('website.edit'));
    $site->refresh();
    expect($site->draft['name'])->toBe('Version One')
        ->and($site->name)->toBe('Version Two');
});

it('records unique-visitor hash, device and utm source on visits', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'title' => 'Home', 'slug' => 'home', 'is_home' => true, 'blocks' => [],
    ]);

    $this->get("/site/{$site->slug}?utm_source=instagram&utm_campaign=spring", [
        'User-Agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari',
    ]);

    $visit = SiteVisit::withoutGlobalScopes()->where('site_id', $site->id)->first();
    expect($visit->visitor_hash)->not->toBeNull()
        ->and($visit->device)->toBe('mobile')
        ->and($visit->utm_source)->toBe('instagram')
        ->and($visit->utm_campaign)->toBe('spring');
});

it('adds author, reading time and related posts to a blog post page', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);
    $blog = SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'title' => 'Journal', 'slug' => 'journal', 'is_blog' => true, 'blocks' => [],
    ]);
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'parent_id' => $blog->id, 'title' => 'Main', 'slug' => 'main', 'author' => 'Jack',
        'status' => 'published', 'published_at' => now()->subDay(),
        'blocks' => [['id' => 'b1', 'type' => 'text', 'data' => ['heading' => '', 'body' => str_repeat('word ', 450)]]],
    ]);
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'parent_id' => $blog->id, 'title' => 'Other', 'slug' => 'other',
        'status' => 'published', 'published_at' => now()->subDays(2), 'blocks' => [],
    ]);

    $this->get("/site/{$site->slug}/journal/main")->assertInertia(fn (AssertableInertia $page) => $page
        ->where('post.author', 'Jack')
        ->where('post.reading_minutes', 3)
        ->count('related_posts', 1)
        ->where('related_posts.0.slug', 'other'));
});

it('shows a coming-soon page for unpublished sites that opt in', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = Site::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'name' => 'Soon Studio', 'slug' => 'soon-studio',
        'template' => 'portfolio', 'is_published' => false,
    ]);

    // Off by default: unpublished = 404.
    $this->get('/site/soon-studio')->assertNotFound();

    $site->update(['coming_soon' => true]);
    $this->get('/site/soon-studio')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
        ->component('Sites/ComingSoon')
        ->where('name', 'Soon Studio'));
});

it('serves the draft on the tokenized preview link, unindexed', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();
    $this->actingAs($user)->get('/website')->assertOk();

    // Save a draft that renames the site + home page.
    $this->actingAs($user)->put(route('website.update'), [
        'name' => 'Draft Name',
        'slug' => Site::withoutGlobalScopes()->where('studio_id', $studio->id)->value('slug'),
        'theme' => ['primary_color' => '#111111', 'font' => 'sans'],
        'header_nav' => [], 'footer_nav' => [],
        'pages' => [
            ['title' => 'Draft Home', 'slug' => 'home', 'is_home' => true, 'is_blog' => false, 'is_post' => false, 'blocks' => []],
        ],
    ])->assertRedirect();

    $this->actingAs($user)->post(route('website.preview.create'))->assertRedirect();
    $site = Site::withoutGlobalScopes()->where('studio_id', $studio->id)->first();
    expect($site->preview_token)->not->toBeNull();

    // The preview (no auth) shows the DRAFT name and is noindexed; live is untouched.
    $this->post(route('logout'));
    $this->get("/site/preview/{$site->preview_token}")
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Sites/Public')
            ->where('site.name', 'Draft Name')
            ->where('site.noindex', true));

    // A bogus token 404s.
    $this->get('/site/preview/not-a-real-token')->assertNotFound();
});

it('captures newsletter signups once per email and ignores honeypot bots', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);

    $this->postJson("/site/{$site->slug}/subscribe", ['email' => 'Fan@Example.com', 'name' => 'A Fan', 'source' => 'home'])
        ->assertOk()->assertJson(['ok' => true]);
    // Same address (different case) doesn't duplicate.
    $this->postJson("/site/{$site->slug}/subscribe", ['email' => 'fan@example.com'])->assertOk();
    // Honeypot-filled bot submissions get a fake OK and store nothing.
    $this->postJson("/site/{$site->slug}/subscribe", ['email' => 'bot@example.com', 'company_website' => 'spam'])->assertOk();

    $subs = SiteSubscriber::withoutGlobalScopes()->where('site_id', $site->id)->get();
    expect($subs)->toHaveCount(1)
        ->and($subs->first()->email)->toBe('fan@example.com')
        ->and($subs->first()->name)->toBe('A Fan');
});

it('rejects a stale-version builder save instead of clobbering newer work', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();
    $this->actingAs($user)->get('/website')->assertOk();

    $payload = fn (string $name) => [
        'name' => $name,
        'slug' => 'race-studio',
        'theme' => ['primary_color' => '#111111', 'font' => 'sans'],
        'header_nav' => [],
        'footer_nav' => [],
        'pages' => [
            ['title' => 'Home', 'slug' => 'home', 'is_home' => true, 'is_blog' => false, 'is_post' => false, 'blocks' => []],
        ],
    ];

    $site = Site::withoutGlobalScopes()->where('studio_id', $studio->id)->first();
    // The version token as both tabs loaded it (from the builder props).
    $version = $this->actingAs($user)->get('/website')->inertiaPage()['props']['site']['version'];

    // Tab A saves with the current version — accepted.
    $this->actingAs($user)->put(route('website.update'), $payload('Tab A') + ['version' => $version])
        ->assertRedirect()->assertSessionHasNoErrors();

    // Tab B still holds the old version — rejected, draft untouched.
    $this->actingAs($user)->put(route('website.update'), $payload('Tab B') + ['version' => $version])
        ->assertRedirect()->assertSessionHasErrors('version');

    expect(Site::withoutGlobalScopes()->find($site->id)->draft['name'])->toBe('Tab A');
});

it('serves a verified custom domain by rewriting to the site path', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);
    $site->update(['custom_domain' => 'photos.example.com', 'domain_verified_at' => now()]);
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'title' => 'Home', 'slug' => 'home', 'is_home' => true, 'blocks' => [],
    ]);

    $this->get('http://photos.example.com/')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Sites/Public')
            ->where('site.name', 'Test Studio')
            // Links are root-relative on the custom domain.
            ->where('site.base_path', ''));

    // An unverified domain falls through to normal platform routing (the
    // Welcome page at /) instead of serving the studio's site.
    $site->update(['domain_verified_at' => null]);
    $this->get('http://photos.example.com/')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('Welcome'));
});

it('serves an RSS feed of published posts and lastmod dates in the sitemap', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);
    $blog = SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'title' => 'Journal', 'slug' => 'journal', 'is_blog' => true, 'blocks' => [],
    ]);
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'parent_id' => $blog->id, 'title' => 'Hello World', 'slug' => 'hello-world',
        'status' => 'published', 'published_at' => now()->subDay(),
        'excerpt' => 'A first post.', 'blocks' => [],
    ]);
    SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'parent_id' => $blog->id, 'title' => 'Secret', 'slug' => 'secret',
        'status' => 'draft', 'blocks' => [],
    ]);

    $feed = $this->get("/site/{$site->slug}/feed")->assertOk()
        ->assertHeader('Content-Type', 'application/rss+xml; charset=UTF-8');
    expect($feed->getContent())->toContain('<title>Hello World</title>')
        ->and($feed->getContent())->not->toContain('Secret');

    $sitemap = $this->get("/site/{$site->slug}/sitemap.xml")->assertOk();
    expect($sitemap->getContent())->toContain('<lastmod>');
});

it('paginates a paginating blog block server-side, with category filters', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);

    $blog = SitePage::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id,
        'title' => 'Journal', 'slug' => 'journal', 'is_blog' => true,
        'blocks' => [['id' => 'b1', 'type' => 'blog', 'data' => ['per_page' => 2]]],
    ]);
    $cat = SiteCategory::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'site_id' => $site->id, 'name' => 'Weddings', 'slug' => 'weddings', 'position' => 1,
    ]);
    foreach ([1, 2, 3] as $i) {
        SitePage::withoutGlobalScopes()->create([
            'studio_id' => $studio->id, 'site_id' => $site->id,
            'parent_id' => $blog->id, 'title' => "Post {$i}", 'slug' => "post-{$i}",
            'status' => 'published', 'published_at' => now()->subDays($i),
            'category_ids' => $i === 1 ? [$cat->id] : [], 'blocks' => [],
        ]);
    }

    // Page 1 ships two posts + the pagination state (not the whole archive).
    $this->get("/site/{$site->slug}/journal")->assertInertia(fn (AssertableInertia $page) => $page
        ->count('posts', 2)
        ->where('blog_state.page', 1)
        ->where('blog_state.page_count', 2)
        ->where('blog_state.total', 3));

    // Page 2 has the remaining post.
    $this->get("/site/{$site->slug}/journal?page=2")->assertInertia(fn (AssertableInertia $page) => $page
        ->count('posts', 1)
        ->where('blog_state.page', 2));

    // Category filter (?category=slug) narrows server-side.
    $this->get("/site/{$site->slug}/journal?category=weddings")->assertInertia(fn (AssertableInertia $page) => $page
        ->count('posts', 1)
        ->where('blog_state.total', 1)
        ->where('blog_state.category', 'weddings'));
});

it('resizes only our own public assets via /img', function () {
    Storage::fake('wasabi');

    // Seed a real PNG into the public bucket space.
    $png = imagecreatetruecolor(900, 600);
    ob_start();
    imagepng($png);
    Storage::disk('wasabi')->put('public/studios/1/site/test.png', ob_get_clean());

    // Foreign URLs and unknown widths are refused (not an open image proxy).
    // Both image endpoints are rate-limited (generously) per IP.
    $this->get('/img?src='.urlencode('https://evil.example/x.png').'&w=384')
        ->assertNotFound()
        ->assertHeader('X-RateLimit-Limit', 300);
    $this->get('/assets/studios/1/site/missing.png')->assertHeader('X-RateLimit-Limit', 600);
    $this->get('/img?src='.urlencode(url('assets/studios/1/site/test.png')).'&w=999')->assertNotFound();

    // Our own asset resizes once and redirects to the cached derivative.
    $this->get('/img?src='.urlencode(url('assets/studios/1/site/test.png')).'&w=384')
        ->assertRedirect()
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public');
    expect(Storage::disk('wasabi')->exists('public/studios/1/site/_rw/384/test.webp'))->toBeTrue();
});

it('queues conversion of a chosen gallery photo and returns its future public url', function () {
    Queue::fake();
    Storage::fake('wasabi');

    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();

    $collection = Collection::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'title' => 'Wedding', 'slug' => 'wedding', 'status' => 'published',
    ]);
    $original = "studios/{$studio->id}/collections/{$collection->id}/originals/1.jpg";

    $photo = Photo::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'collection_id' => $collection->id, 'filename' => 'p.jpg',
        'wasabi_key_original' => $original,
        'status' => 'ready', 'derivative_keys' => ['web' => "studios/{$studio->id}/collections/{$collection->id}/photos/1/web.jpg"],
    ]);

    $res = $this->actingAs($user)->postJson(route('website.gallery.import'), ['photo_ids' => [$photo->id]]);

    // Instant response with the permanent URL; the heavy convert runs on the queue.
    $res->assertOk();
    expect($res->json('urls'))->toHaveCount(1);
    Queue::assertPushed(ImportSiteImage::class, fn ($job) => $job->sourceKey === $original && $job->maxWidth === 1920);
});

it('requires a name and email to submit an enquiry', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);
    $site->pages()->create([
        'studio_id' => $studio->id,
        'title' => 'Home',
        'slug' => 'home',
        'is_home' => true,
        'blocks' => [],
    ]);

    $this->from("/site/{$site->slug}")
        ->post("/site/{$site->slug}/contact", ['name' => '', 'email' => 'not-an-email'])
        ->assertSessionHasErrors(['name', 'email']);
});

it('creates hierarchical blog categories over ajax', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();
    $this->actingAs($user)->get('/website')->assertOk();

    // Parent.
    $res = $this->actingAs($user)->postJson(route('website.categories.store'), ['name' => 'Weddings']);
    $res->assertOk();
    $parent = collect($res->json('categories'))->firstWhere('name', 'Weddings');
    expect($parent['parent_id'])->toBeNull()
        ->and($parent['slug'])->toBe('weddings');

    // Child under the parent.
    $res = $this->actingAs($user)->postJson(route('website.categories.store'), ['name' => 'Real Weddings', 'parent_id' => $parent['id']]);
    $child = collect($res->json('categories'))->firstWhere('name', 'Real Weddings');
    expect($child['parent_id'])->toBe($parent['id']);
});

it('attaches multiple categories to a post through a save', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();
    $this->actingAs($user)->get('/website')->assertOk();

    $a = $this->actingAs($user)->postJson(route('website.categories.store'), ['name' => 'Weddings'])->json('categories');
    $weddings = collect($a)->firstWhere('name', 'Weddings');
    $b = $this->actingAs($user)->postJson(route('website.categories.store'), ['name' => 'Tips'])->json('categories');
    $tips = collect($b)->firstWhere('name', 'Tips');

    $this->actingAs($user)->put(route('website.update'), [
        'name' => 'My Studio',
        'slug' => 'cat-studio',
        'theme' => ['primary_color' => '#111111', 'font' => 'sans'],
        'header_nav' => [],
        'footer_nav' => [],
        'pages' => [
            ['title' => 'Home', 'slug' => 'home', 'is_home' => true, 'is_blog' => false, 'is_post' => false, 'blocks' => []],
            ['title' => 'Blog', 'slug' => 'blog', 'is_home' => false, 'is_blog' => true, 'is_post' => false, 'blocks' => []],
            ['title' => 'Post', 'slug' => 'post', 'is_post' => true, 'status' => 'published', 'blocks' => [], 'category_ids' => [$weddings['id'], $tips['id']]],
        ],
    ])->assertRedirect();
    $this->actingAs($user)->post(route('website.publish'), ['publish' => true])->assertRedirect();

    $post = SitePage::withoutGlobalScopes()->where('slug', 'post')->first();
    expect($post->category_ids)->toEqualCanonicalizing([$weddings['id'], $tips['id']]);
});

it('strips stale category ids that do not belong to the site on save', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();
    $this->actingAs($user)->get('/website')->assertOk();

    $this->actingAs($user)->put(route('website.update'), [
        'name' => 'My Studio',
        'slug' => 'stale-studio',
        'theme' => ['primary_color' => '#111111', 'font' => 'sans'],
        'header_nav' => [],
        'footer_nav' => [],
        'pages' => [
            ['title' => 'Home', 'slug' => 'home', 'is_home' => true, 'is_blog' => false, 'is_post' => false, 'blocks' => []],
            ['title' => 'Blog', 'slug' => 'blog', 'is_home' => false, 'is_blog' => true, 'is_post' => false, 'blocks' => []],
            ['title' => 'Post', 'slug' => 'post', 'is_post' => true, 'status' => 'published', 'blocks' => [], 'category_ids' => [999999]],
        ],
    ])->assertRedirect();
    $this->actingAs($user)->post(route('website.publish'), ['publish' => true])->assertRedirect();

    $post = SitePage::withoutGlobalScopes()->where('slug', 'post')->first();
    expect($post->category_ids)->toBe([]);
});

it('reparents children and detaches posts when a category is deleted', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();
    $this->actingAs($user)->get('/website')->assertOk();

    $parent = collect($this->actingAs($user)->postJson(route('website.categories.store'), ['name' => 'Weddings'])->json('categories'))->firstWhere('name', 'Weddings');
    $child = collect($this->actingAs($user)->postJson(route('website.categories.store'), ['name' => 'Real Weddings', 'parent_id' => $parent['id']])->json('categories'))->firstWhere('name', 'Real Weddings');

    // A post tagged to the parent.
    $this->actingAs($user)->put(route('website.update'), [
        'name' => 'My Studio', 'slug' => 'del-studio',
        'theme' => ['primary_color' => '#111111', 'font' => 'sans'], 'header_nav' => [], 'footer_nav' => [],
        'pages' => [
            ['title' => 'Home', 'slug' => 'home', 'is_home' => true, 'is_blog' => false, 'is_post' => false, 'blocks' => []],
            ['title' => 'Blog', 'slug' => 'blog', 'is_home' => false, 'is_blog' => true, 'is_post' => false, 'blocks' => []],
            ['title' => 'Post', 'slug' => 'post', 'is_post' => true, 'status' => 'published', 'blocks' => [], 'category_ids' => [$parent['id']]],
        ],
    ])->assertRedirect();
    $this->actingAs($user)->post(route('website.publish'), ['publish' => true])->assertRedirect();

    $this->actingAs($user)->deleteJson(route('website.categories.destroy', $parent['id']))->assertOk();

    // Child moved up to root; post no longer references the deleted category.
    $reloadedChild = SiteCategory::withoutGlobalScopes()->find($child['id']);
    expect($reloadedChild->parent_id)->toBeNull();
    $post = SitePage::withoutGlobalScopes()->where('slug', 'post')->first();
    expect($post->category_ids)->toBe([]);
});

it('hides a category from the blog filter when the blog page unticks it', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();
    $this->actingAs($user)->get('/website')->assertOk();

    $visible = collect($this->actingAs($user)->postJson(route('website.categories.store'), ['name' => 'Visible'])->json('categories'))->firstWhere('name', 'Visible');
    $hidden = collect($this->actingAs($user)->postJson(route('website.categories.store'), ['name' => 'Hidden'])->json('categories'))->firstWhere('name', 'Hidden');

    $this->actingAs($user)->put(route('website.update'), [
        'name' => 'My Studio', 'slug' => 'hide-studio',
        'theme' => ['primary_color' => '#111111', 'font' => 'sans'], 'header_nav' => [], 'footer_nav' => [],
        'pages' => [
            ['title' => 'Home', 'slug' => 'home', 'is_home' => true, 'is_blog' => false, 'is_post' => false, 'blocks' => []],
            // The blog page carries a blog block (as templates seed it) — the
            // categories/posts props are only shipped to pages that use them.
            ['title' => 'Blog', 'slug' => 'blog', 'is_home' => false, 'is_blog' => true, 'is_post' => false, 'blocks' => [['id' => 'b1', 'type' => 'blog', 'data' => []]], 'hidden_category_ids' => [$hidden['id']]],
            ['title' => 'A', 'slug' => 'post-a', 'is_post' => true, 'status' => 'published', 'blocks' => [], 'category_ids' => [$visible['id']]],
            ['title' => 'B', 'slug' => 'post-b', 'is_post' => true, 'status' => 'published', 'blocks' => [], 'category_ids' => [$hidden['id']]],
        ],
    ])->assertRedirect();
    $this->actingAs($user)->post(route('website.publish'), ['publish' => true])->assertRedirect();

    $site = Site::withoutGlobalScopes()->where('studio_id', $studio->id)->first();

    // The hidden category is dropped from the filter prop; the visible one remains.
    $this->get("/site/{$site->slug}/blog")
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Sites/Public')
            ->where('categories', fn ($cats) => collect($cats)->pluck('name')->all() === ['Visible'])
        );

    // The blog page still persisted the hidden id.
    $blog = SitePage::withoutGlobalScopes()->where('site_id', $site->id)->where('is_blog', true)->first();
    expect($blog->hidden_category_ids)->toBe([$hidden['id']]);
});
