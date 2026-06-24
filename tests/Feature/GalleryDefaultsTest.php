<?php

use App\Models\Collection;
use App\Models\PriceSheet;
use App\Models\Studio;
use App\Models\User;

function defaultsStudio(): array
{
    $studio = Studio::factory()->create();
    $user = User::factory()->for($studio)->create();
    app()->instance('current.studio.id', $studio->id);

    return [$studio, $user];
}

it('attaches the studio default price sheet to a new gallery', function () {
    [$studio, $user] = defaultsStudio();
    $sheet = PriceSheet::create([
        'studio_id' => $studio->id, 'name' => 'Default price sheet', 'is_default' => true, 'fulfilment' => 'lab',
    ]);

    $this->actingAs($user)->post(route('collections.store'), ['title' => 'Smith Wedding'])->assertRedirect();

    expect(Collection::where('title', 'Smith Wedding')->first()->price_sheet_id)->toBe($sheet->id);
});

it('saves a gallery\'s settings as the studio default', function () {
    [$studio, $user] = defaultsStudio();
    $collection = Collection::create([
        'studio_id' => $studio->id, 'title' => 'Template', 'slug' => 'template-x', 'status' => 'draft',
        'theme' => 'cream', 'download_settings' => ['enabled' => true],
    ]);

    $this->actingAs($user)->post(route('collections.save-defaults', $collection->id))->assertRedirect();

    $defaults = $studio->fresh()->gallery_defaults;
    expect($defaults['theme'])->toBe('cream');
    expect($defaults['download_settings'])->toBe(['enabled' => true]);
});

it('applies saved defaults to newly created galleries', function () {
    [$studio, $user] = defaultsStudio();
    $studio->update(['gallery_defaults' => [
        'theme' => 'stone',
        'download_settings' => ['enabled' => true, 'allow_original' => true],
        'guest_upload_settings' => ['enabled' => true, 'set_id' => 999],
        'email_gate' => true,
        'price_sheet_id' => null,
    ]]);

    $this->actingAs($user)->post(route('collections.store'), ['title' => 'New One'])->assertRedirect();

    $c = Collection::where('title', 'New One')->first();
    expect($c->theme)->toBe('stone');
    expect($c->download_settings)->toBe(['enabled' => true, 'allow_original' => true]);
    expect($c->privacy['email_gate'])->toBeTrue();
    // The per-gallery set_id from the template is never copied over.
    expect($c->guest_upload_settings['enabled'])->toBeTrue();
    expect($c->guest_upload_settings)->not->toHaveKey('set_id');
});
