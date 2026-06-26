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

it('emails the studio on a new lead and an autoresponder when requested', function () {
    Mail::fake();
    $studio = Studio::factory()->onPaidPlan()->create(['email' => 'studio@example.com']);
    $site = publishedSite($studio);

    $this->post("/site/{$site->slug}/contact", [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'autoresponder' => true,
        'autoresponder_subject' => 'Got it!',
        'autoresponder_message' => 'Thanks Jane.',
    ])->assertRedirect();

    Mail::assertSent(ClientMessage::class, fn ($m) => $m->hasTo('studio@example.com'));
    Mail::assertSent(ClientMessage::class, fn ($m) => $m->hasTo('jane@example.com'));
});

it('does not send an autoresponder unless opted in', function () {
    Mail::fake();
    $studio = Studio::factory()->onPaidPlan()->create(['email' => 'studio@example.com']);
    $site = publishedSite($studio);

    $this->post("/site/{$site->slug}/contact", [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
    ])->assertRedirect();

    Mail::assertSent(ClientMessage::class, fn ($m) => $m->hasTo('studio@example.com'));
    Mail::assertNotSent(ClientMessage::class, fn ($m) => $m->hasTo('jane@example.com'));
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
        ->and($lead->payload['attachment_url'])->not->toBeNull();

    $project = Project::withoutGlobalScopes()->where('contact_id', $lead->contact_id)->first();
    expect($project->notes)->toContain('Venue: The Barn')->toContain('Attachment:');
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

    $site = Site::withoutGlobalScopes()->where('studio_id', $studio->id)->first();
    $blog = SitePage::withoutGlobalScopes()->where('site_id', $site->id)->where('is_blog', true)->first();
    $post = SitePage::withoutGlobalScopes()->where('site_id', $site->id)->where('slug', 'my-post')->first();

    expect($post->parent_id)->toBe($blog->id)
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
            ['title' => 'Blog', 'slug' => 'blog', 'is_home' => false, 'is_blog' => true, 'is_post' => false, 'blocks' => [], 'hidden_category_ids' => [$hidden['id']]],
            ['title' => 'A', 'slug' => 'post-a', 'is_post' => true, 'status' => 'published', 'blocks' => [], 'category_ids' => [$visible['id']]],
            ['title' => 'B', 'slug' => 'post-b', 'is_post' => true, 'status' => 'published', 'blocks' => [], 'category_ids' => [$hidden['id']]],
        ],
    ])->assertRedirect();

    Site::withoutGlobalScopes()->where('studio_id', $studio->id)->update(['is_published' => true, 'published_at' => now()]);
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
