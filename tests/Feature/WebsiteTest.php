<?php

use App\Models\Collection;
use App\Models\Contact;
use App\Models\Photo;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\Site;
use App\Models\SiteLead;
use App\Models\SitePage;
use App\Models\Studio;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

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
        'status' => 'lead',
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

it('reuses an existing contact by email instead of duplicating', function () {
    $studio = Studio::factory()->onPaidPlan()->create();
    $site = publishedSite($studio);

    $existing = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id,
        'first_name' => 'Repeat',
        'email' => 'repeat@example.com',
        'status' => 'client',
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

it('imports a chosen gallery photo into the site as a permanent public image', function () {
    Storage::fake('wasabi');
    Storage::fake('public');

    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();

    $collection = Collection::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'title' => 'Wedding', 'slug' => 'wedding', 'status' => 'published',
    ]);
    $key = "studios/{$studio->id}/collections/{$collection->id}/photos/1/web.jpg";
    Storage::disk('wasabi')->put($key, 'fake-image-bytes');

    $photo = Photo::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'collection_id' => $collection->id, 'filename' => 'p.jpg',
        'wasabi_key_original' => "studios/{$studio->id}/collections/{$collection->id}/originals/1.jpg",
        'status' => 'ready', 'derivative_keys' => ['web' => $key],
    ]);

    $res = $this->actingAs($user)->postJson(route('website.gallery.import'), ['photo_ids' => [$photo->id]]);

    $res->assertOk();
    expect($res->json('urls'))->toHaveCount(1)
        ->and(Storage::disk('public')->allFiles())->not->toBeEmpty();
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
