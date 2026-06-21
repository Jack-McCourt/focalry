<?php

use App\Models\Collection;
use App\Models\Studio;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

function lightroomStudio(array $userAttrs = []): array
{
    $studio = Studio::factory()->create();
    $user = User::factory()->for($studio)->create(array_merge([
        'email' => 'pro@studio.test',
        'password' => bcrypt('secret-pass'),
        'email_verified_at' => now(),
    ], $userAttrs));
    app()->instance('current.studio.id', $studio->id);

    return [$studio, $user];
}

it('issues a token for valid credentials', function () {
    [$studio, $user] = lightroomStudio();

    $res = $this->postJson(route('lightroom.login'), [
        'email' => 'pro@studio.test',
        'password' => 'secret-pass',
        'device_name' => 'Jacks Laptop',
    ]);

    $res->assertOk()
        ->assertJsonStructure(['token', 'user' => ['name', 'email'], 'studio' => ['id', 'name']])
        ->assertJsonPath('studio.id', $studio->id);

    expect($user->fresh()->tokens()->count())->toBe(1);
});

it('rejects invalid credentials', function () {
    lightroomStudio();

    $this->postJson(route('lightroom.login'), [
        'email' => 'pro@studio.test',
        'password' => 'wrong',
    ])->assertStatus(422)->assertJsonValidationErrors('email');
});

it('refuses login until the email is verified', function () {
    lightroomStudio(['email_verified_at' => null]);

    $this->postJson(route('lightroom.login'), [
        'email' => 'pro@studio.test',
        'password' => 'secret-pass',
    ])->assertStatus(422)->assertJsonValidationErrors('email');
});

it('returns the account for a valid token', function () {
    [$studio, $user] = lightroomStudio();
    Sanctum::actingAs($user);

    $this->getJson(route('lightroom.account'))
        ->assertOk()
        ->assertJsonPath('studio.id', $studio->id)
        ->assertJsonPath('user.email', 'pro@studio.test');
});

it('lists only the studio\'s own galleries', function () {
    [$studio, $user] = lightroomStudio();
    Collection::create(['studio_id' => $studio->id, 'title' => 'Smith Wedding', 'slug' => 'smith-abc123', 'status' => 'draft']);

    // A gallery in another studio must not leak.
    $other = Studio::factory()->create();
    Collection::create(['studio_id' => $other->id, 'title' => 'Other Studio', 'slug' => 'other-xyz789', 'status' => 'draft']);

    Sanctum::actingAs($user);

    $this->getJson(route('lightroom.collections'))
        ->assertOk()
        ->assertJsonCount(1, 'collections')
        ->assertJsonPath('collections.0.title', 'Smith Wedding');
});

it('creates a gallery with a unique slug and a default set', function () {
    [$studio, $user] = lightroomStudio();
    Sanctum::actingAs($user);

    $res = $this->postJson(route('lightroom.collections.store'), [
        'title' => 'Jones Engagement',
    ]);

    $res->assertCreated()->assertJsonPath('collection.title', 'Jones Engagement');

    $collection = Collection::where('studio_id', $studio->id)->firstOrFail();
    expect($collection->slug)->toStartWith('jones-engagement-');
    expect($collection->sets()->where('name', 'Highlights')->exists())->toBeTrue();
});
