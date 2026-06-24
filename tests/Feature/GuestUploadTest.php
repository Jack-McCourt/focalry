<?php

use App\Jobs\ProcessPhoto;
use App\Models\Collection;
use App\Models\Photo;
use App\Models\Set;
use App\Models\Studio;
use App\Models\User;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

/** A studio + verified owner, with the tenant scope bound. */
function guestStudio(): array
{
    $studio = Studio::factory()->create();
    $user = User::factory()->for($studio)->create(['email_verified_at' => now()]);
    app()->instance('current.studio.id', $studio->id);

    return [$studio, $user];
}

function publishedCollection(Studio $studio, array $settings = []): Collection
{
    return Collection::create([
        'studio_id' => $studio->id,
        'title' => 'Smith Wedding',
        'slug' => 'smith-'.uniqid(),
        'status' => 'published',
        'guest_upload_settings' => $settings ?: null,
    ]);
}

it('404s the public upload page when guest uploads are disabled', function () {
    [$studio] = guestStudio();
    $collection = publishedCollection($studio, ['enabled' => false]);

    $this->get(route('gallery.guest-upload', $collection->slug))->assertNotFound();
});

it('shows the upload page when enabled', function () {
    [$studio] = guestStudio();
    $collection = publishedCollection($studio, ['enabled' => true, 'title' => 'Share your photos']);

    $this->get(route('gallery.guest-upload', $collection->slug))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Gallery/GuestUpload')
            ->where('pin_required', false)
            ->where('title', 'Share your photos'));
});

it('shows the shared wall of approved guest photos but hides pending ones', function () {
    [$studio] = guestStudio();
    $collection = publishedCollection($studio, ['enabled' => true]);
    $set = $collection->sets()->create(['name' => 'Guest Photos', 'position' => 1, 'visible' => true]);

    $base = fn (array $extra) => array_merge([
        'studio_id' => $studio->id, 'collection_id' => $collection->id, 'set_id' => $set->id,
        'filename' => 'x.jpg', 'wasabi_key_original' => 'k.jpg', 'status' => 'ready', 'is_guest_upload' => true,
    ], $extra);

    \App\Models\Photo::create($base(['approved' => true]));
    \App\Models\Photo::create($base(['approved' => false]));

    $this->get(route('gallery.guest-upload', $collection->slug))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('photos', 1));
});

it('rejects the wrong PIN and accepts the right one', function () {
    [$studio] = guestStudio();
    $collection = publishedCollection($studio, ['enabled' => true, 'pin' => '1234']);

    $this->postJson(route('gallery.guest-upload.verify-pin', $collection->slug), ['pin' => '0000'])
        ->assertStatus(422)->assertJsonPath('ok', false);

    $this->postJson(route('gallery.guest-upload.verify-pin', $collection->slug), ['pin' => '1234'])
        ->assertOk()->assertJsonPath('ok', true)
        ->assertSessionHas("gallery_guest_upload_pin_{$collection->id}", true);
});

it('blocks presign and register without the PIN', function () {
    [$studio] = guestStudio();
    $collection = publishedCollection($studio, ['enabled' => true, 'pin' => '1234']);

    $this->postJson(route('gallery.guest-upload.presign', $collection->slug), [
        'filename' => 'a.jpg', 'content_type' => 'image/jpeg', 'file_size' => 1000,
    ])->assertStatus(403);

    $this->postJson(route('gallery.guest-upload.register', $collection->slug), [
        'filename' => 'a.jpg', 'wasabi_key' => 'x',
    ])->assertStatus(403);
});

it('registers an approved guest photo when approval is off', function () {
    Queue::fake();
    [$studio] = guestStudio();
    $collection = publishedCollection($studio, ['enabled' => true, 'require_approval' => false]);

    $key = "studios/{$studio->id}/collections/{$collection->id}/originals/abc.jpg";

    $this->postJson(route('gallery.guest-upload.register', $collection->slug), [
        'filename' => 'beach.jpg', 'wasabi_key' => $key, 'file_size' => 5000, 'uploader_name' => 'Sam',
    ])->assertCreated();

    $photo = Photo::where('collection_id', $collection->id)->first();
    expect($photo)->not->toBeNull();
    expect($photo->is_guest_upload)->toBeTrue();
    expect($photo->approved)->toBeTrue();
    expect($photo->uploader_name)->toBe('Sam');
    Queue::assertPushed(ProcessPhoto::class);
});

it('registers a pending guest photo when approval is on', function () {
    Queue::fake();
    [$studio] = guestStudio();
    $collection = publishedCollection($studio, ['enabled' => true, 'require_approval' => true]);

    $key = "studios/{$studio->id}/collections/{$collection->id}/originals/abc.jpg";

    $this->postJson(route('gallery.guest-upload.register', $collection->slug), [
        'filename' => 'beach.jpg', 'wasabi_key' => $key, 'file_size' => 5000,
    ])->assertCreated();

    expect(Photo::where('collection_id', $collection->id)->first()->approved)->toBeFalse();
});

it('rejects a wasabi key from another collection', function () {
    Queue::fake();
    [$studio] = guestStudio();
    $collection = publishedCollection($studio, ['enabled' => true]);

    $this->postJson(route('gallery.guest-upload.register', $collection->slug), [
        'filename' => 'beach.jpg', 'wasabi_key' => 'studios/999/collections/999/originals/abc.jpg',
    ])->assertStatus(422);

    expect(Photo::where('collection_id', $collection->id)->count())->toBe(0);
});

it('hides pending guest photos from the public gallery but shows approved ones', function () {
    [$studio] = guestStudio();
    $collection = publishedCollection($studio, ['enabled' => true]);
    $set = $collection->sets()->create(['name' => 'Guest Photos', 'position' => 1, 'visible' => true]);

    $base = fn (array $extra) => array_merge([
        'studio_id' => $studio->id,
        'collection_id' => $collection->id,
        'set_id' => $set->id,
        'filename' => 'x.jpg',
        'wasabi_key_original' => 'studios/x/originals/x.jpg',
        'status' => 'ready',
        'is_guest_upload' => true,
    ], $extra);

    Photo::create($base(['approved' => true, 'position' => 1]));
    Photo::create($base(['approved' => false, 'position' => 2]));

    $this->get(route('gallery.show', $collection->slug))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('photos', 1));
});

it('lets the studio save settings and toggles the guest set visibility', function () {
    [$studio, $user] = guestStudio();
    $collection = publishedCollection($studio);

    $this->actingAs($user)->patch(route('collections.guest-uploads.update', $collection->id), [
        'enabled' => true, 'pin' => '4321', 'require_approval' => true,
        'show_as_tab' => true, 'title' => 'Upload', 'message' => 'Please share',
    ])->assertRedirect();

    $collection->refresh();
    expect($collection->guestUploadsEnabled())->toBeTrue();
    expect($collection->guestUploadPin())->toBe('4321');

    $set = Set::where('collection_id', $collection->id)->first();
    expect($set)->not->toBeNull();
    expect($set->visible)->toBeTrue();

    // Turning the tab off hides the set.
    $this->actingAs($user)->patch(route('collections.guest-uploads.update', $collection->id), [
        'enabled' => true, 'pin' => '4321', 'require_approval' => true,
        'show_as_tab' => false, 'title' => 'Upload', 'message' => 'Please share',
    ])->assertRedirect();

    expect($set->fresh()->visible)->toBeFalse();
});

it('approves a pending guest photo from the admin', function () {
    [$studio, $user] = guestStudio();
    $collection = publishedCollection($studio, ['enabled' => true]);
    $set = $collection->sets()->create(['name' => 'Guest Photos', 'position' => 1, 'visible' => true]);
    $photo = Photo::create([
        'studio_id' => $studio->id, 'collection_id' => $collection->id, 'set_id' => $set->id,
        'filename' => 'x.jpg', 'wasabi_key_original' => 'studios/x/originals/x.jpg',
        'status' => 'ready', 'is_guest_upload' => true, 'approved' => false,
    ]);

    $this->actingAs($user)
        ->post(route('collections.guest-uploads.approve', [$collection->id, $photo->id]))
        ->assertRedirect();

    expect($photo->fresh()->approved)->toBeTrue();
});

it('returns the A6 PDF card', function () {
    [$studio, $user] = guestStudio();
    $collection = publishedCollection($studio, ['enabled' => true, 'pin' => '1234']);

    $res = $this->actingAs($user)->get(route('collections.guest-uploads.card', $collection->id));

    $res->assertOk();
    expect($res->headers->get('content-type'))->toContain('application/pdf');
});
