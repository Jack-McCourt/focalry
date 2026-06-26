<?php

use App\Models\Contact;
use App\Models\Package;
use App\Models\PackageBooking;
use App\Models\Project;
use App\Models\Studio;
use App\Models\User;
use App\Services\PackageFulfillment;

function packageStudio(): array
{
    $studio = Studio::factory()->onPaidPlan()->create(['slug' => 'lens-studio']);
    $user = User::factory()->for($studio)->create();
    app()->instance('current.studio.id', $studio->id);

    return [$studio, $user];
}

function makePackage(int $studioId, array $attrs = []): Package
{
    return Package::create(array_merge([
        'studio_id' => $studioId,
        'name' => 'Half-day shoot',
        'description' => 'Four hours of coverage',
        'price_cents' => 50000,
        'currency' => 'usd',
        'active' => true,
    ], $attrs));
}

it('creates a package with an auto slug', function () {
    [$studio, $user] = packageStudio();

    $this->actingAs($user)->post(route('packages.store'), [
        'name' => 'Full Day Wedding',
        'price_cents' => 200000,
        'currency' => 'usd',
        'active' => 1,
    ])->assertRedirect()->assertSessionHasNoErrors();

    $pkg = Package::withoutGlobalScopes()->first();
    expect($pkg->slug)->toBe('full-day-wedding')->and($pkg->price_cents)->toBe(200000);
});

it('rejects a deposit that is not less than the price', function () {
    [$studio, $user] = packageStudio();

    $this->actingAs($user)->post(route('packages.store'), [
        'name' => 'X', 'price_cents' => 10000, 'deposit_cents' => 10000, 'currency' => 'usd', 'active' => 1,
    ])->assertSessionHasErrors('deposit_cents');
});

it('shows only active packages on the public page', function () {
    [$studio] = packageStudio();
    makePackage($studio->id, ['name' => 'Visible']);
    makePackage($studio->id, ['name' => 'Hidden', 'active' => false]);

    $this->get(route('packages.public', 'lens-studio'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Public/Packages/Index')->has('packages', 1));
});

it('books a free package immediately and creates a project + lead', function () {
    [$studio] = packageStudio();
    $package = makePackage($studio->id, ['price_cents' => 0]);

    $this->post(route('packages.public.checkout', ['slug' => 'lens-studio', 'package' => $package->slug]), [
        'client_name' => 'Dana Lee',
        'client_email' => 'dana@example.com',
        'payment_type' => 'full',
    ])->assertRedirect();

    $booking = PackageBooking::withoutGlobalScopes()->first();
    expect($booking->status)->toBe('paid')->and($booking->project_id)->not->toBeNull();

    $contact = Contact::withoutGlobalScopes()->where('email', 'dana@example.com')->first();
    expect($contact)->not->toBeNull();

    $project = Project::withoutGlobalScopes()->find($booking->project_id);
    expect($project)->not->toBeNull()
        ->and($project->contact_id)->toBe($contact->id)
        ->and($project->name)->toContain('Half-day shoot');
});

it('fulfilment is idempotent on replayed webhooks', function () {
    [$studio] = packageStudio();
    $package = makePackage($studio->id);
    $contact = Contact::create([
        'studio_id' => $studio->id, 'first_name' => 'Dana', 'email' => 'dana@example.com',
    ]);
    $booking = PackageBooking::create([
        'studio_id' => $studio->id, 'package_id' => $package->id, 'contact_id' => $contact->id,
        'client_name' => 'Dana Lee', 'client_email' => 'dana@example.com',
        'amount_cents' => 50000, 'payment_type' => 'full', 'currency' => 'usd', 'status' => 'pending',
    ]);

    $service = app(PackageFulfillment::class);
    $service->markPaid($booking, 'pi_123', 50000);
    $service->markPaid($booking->refresh(), 'pi_123', 50000);

    expect(Project::withoutGlobalScopes()->where('studio_id', $studio->id)->count())->toBe(1)
        ->and($booking->refresh()->status)->toBe('paid');
});
