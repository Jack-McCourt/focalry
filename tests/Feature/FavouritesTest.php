<?php

use App\Models\Collection;
use App\Models\Photo;
use App\Models\Studio;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

function favStudio(): array
{
    $studio = Studio::factory()->create();
    $user = User::factory()->for($studio)->create(['email_verified_at' => now()]);
    app()->instance('current.studio.id', $studio->id);

    return [$studio, $user];
}

function favPhoto(Collection $c, array $extra = []): Photo
{
    static $set = [];
    $set[$c->id] ??= $c->sets()->create(['name' => 'Highlights', 'position' => 1, 'visible' => true]);

    return Photo::create(array_merge([
        'studio_id' => $c->studio_id,
        'collection_id' => $c->id,
        'set_id' => $set[$c->id]->id,
        'filename' => 'x.jpg',
        'wasabi_key_original' => 'studios/x/originals/'.uniqid().'.jpg',
        'status' => 'ready',
    ], $extra));
}

it('toggles the photographer star on a photo', function () {
    [$studio, $user] = favStudio();
    $collection = Collection::create(['studio_id' => $studio->id, 'title' => 'G', 'slug' => 'g-'.uniqid(), 'status' => 'draft']);
    $photo = favPhoto($collection);

    Sanctum::actingAs($user);

    $this->postJson(route('photos.star', $photo->id))->assertOk()->assertJsonPath('starred', true);
    expect($photo->fresh()->starred)->toBeTrue();

    $this->postJson(route('photos.star', $photo->id))->assertOk()->assertJsonPath('starred', false);
    expect($photo->fresh()->starred)->toBeFalse();
});

it('groups starred photos by gallery on the favourites page', function () {
    [$studio, $user] = favStudio();
    $a = Collection::create(['studio_id' => $studio->id, 'title' => 'Alpha', 'slug' => 'a-'.uniqid(), 'status' => 'draft']);
    $b = Collection::create(['studio_id' => $studio->id, 'title' => 'Beta', 'slug' => 'b-'.uniqid(), 'status' => 'draft']);

    favPhoto($a, ['starred' => true]);
    favPhoto($a, ['starred' => true]);
    favPhoto($a, ['starred' => false]); // not starred → excluded
    favPhoto($b, ['starred' => true]);

    $this->actingAs($user)->get(route('favourites.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('Favourites/Index')
            ->where('total', 3)
            ->has('groups', 2));
});

it('404s a favourites download when a gallery has none', function () {
    [$studio, $user] = favStudio();
    $collection = Collection::create(['studio_id' => $studio->id, 'title' => 'Empty', 'slug' => 'e-'.uniqid(), 'status' => 'draft']);
    favPhoto($collection, ['starred' => false]);

    $this->actingAs($user)->get(route('favourites.download', $collection->id))->assertNotFound();
});
