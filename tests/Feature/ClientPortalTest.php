<?php

use App\Mail\ClientPortalInvite;
use App\Models\ClientPortalAccess;
use App\Models\Collection;
use App\Models\Contact;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\Studio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

function makePortal(): ClientPortalAccess
{
    $studio = Studio::factory()->create();
    app()->instance('current.studio.id', $studio->id);

    $contact = Contact::create([
        'studio_id' => $studio->id,
        'first_name' => 'Holly',
        'last_name' => 'Jones',
        'email' => 'holly@example.com',
    ]);
    $project = Project::create([
        'studio_id' => $studio->id,
        'contact_id' => $contact->id,
        'name' => 'Holly & Daniel Wedding',
    ]);

    // A published gallery + a sent invoice + a sent contract — the things a
    // client should see in the portal.
    Collection::create([
        'studio_id' => $studio->id,
        'contact_id' => $contact->id,
        'project_id' => $project->id,
        'title' => 'Wedding Day',
        'slug' => 'wedding-day-'.uniqid(),
        'status' => 'published',
    ]);
    Invoice::create([
        'studio_id' => $studio->id,
        'contact_id' => $contact->id,
        'project_id' => $project->id,
        'number' => 'INV-1',
        'status' => 'sent',
        'currency' => 'gbp',
    ])->forceFill(['total_cents' => 50000, 'amount_paid_cents' => 0])->save();
    Contract::create([
        'studio_id' => $studio->id,
        'contact_id' => $contact->id,
        'project_id' => $project->id,
        'title' => 'Wedding Contract',
        'body' => 'Terms',
        'status' => 'sent',
    ]);

    // Draft invoice must NOT leak to the client.
    Invoice::create([
        'studio_id' => $studio->id,
        'contact_id' => $contact->id,
        'project_id' => $project->id,
        'number' => 'INV-DRAFT',
        'status' => 'draft',
        'currency' => 'gbp',
    ])->forceFill(['total_cents' => 999])->save();

    return ClientPortalAccess::create([
        'studio_id' => $studio->id,
        'contact_id' => $contact->id,
    ]);
}

it('shows the verification gate, not the portal, on first visit', function () {
    $portal = makePortal();

    $this->get(route('portal.show', $portal->token))
        ->assertInertia(fn (AssertableInertia $p) => $p->component('Public/ClientPortalVerify')
            ->where('masked_email', 'h••••@example.com'));
});

it('emails the invite code and unlocks the aggregated portal', function () {
    Mail::fake();
    $portal = makePortal();

    $this->post(route('portal.code', $portal->token))->assertRedirect();

    $code = null;
    Mail::assertSent(ClientPortalInvite::class, function (ClientPortalInvite $m) use (&$code) {
        $code = $m->code;

        return $m->hasTo('holly@example.com');
    });

    $this->post(route('portal.verify', $portal->token), ['code' => '000000'])
        ->assertSessionHasErrors('code');

    $this->post(route('portal.verify', $portal->token), ['code' => $code])
        ->assertRedirect(route('portal.show', $portal->token));

    $this->get(route('portal.show', $portal->token))
        ->assertInertia(fn (AssertableInertia $p) => $p->component('Public/ClientPortal')
            ->where('client_name', 'Holly')
            ->has('projects', 1)
            ->where('projects.0.name', 'Holly & Daniel Wedding')
            ->has('projects.0.items.galleries', 1)
            ->has('projects.0.items.invoices', 1) // draft excluded
            ->has('projects.0.items.contracts', 1)
            ->where('projects.0.items.invoices.0.number', 'INV-1'));

    expect($portal->fresh()->last_viewed_at)->not->toBeNull();
});

it('404s an unknown token', function () {
    $this->get(route('portal.show', 'not-a-real-token'))->assertNotFound();
});

it('lets a studio invite a contact and reuses the same access', function () {
    Mail::fake();
    $studio = Studio::factory()->onPaidPlan()->create();
    app()->instance('current.studio.id', $studio->id);
    $user = User::factory()->for($studio)->create();
    $contact = Contact::create([
        'studio_id' => $studio->id,
        'first_name' => 'Sam',
        'email' => 'sam@example.com',
    ]);

    $this->actingAs($user)->post(route('contacts.portal.invite', $contact->id))->assertRedirect();
    $this->actingAs($user)->post(route('contacts.portal.invite', $contact->id))->assertRedirect();

    expect(ClientPortalAccess::where('contact_id', $contact->id)->count())->toBe(1);
    Mail::assertSent(ClientPortalInvite::class, 2);
});
