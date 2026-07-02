<?php

use App\Mail\ClientMessage;
use App\Models\ClientEmail;
use App\Models\Contact;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\Proposal;
use App\Models\Studio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

function proposalSetup(?string $email = 'holly@example.com'): array
{
    $studio = Studio::factory()->onPaidPlan()->create();
    app()->instance('current.studio.id', $studio->id);
    $user = User::factory()->for($studio)->create();
    $contact = Contact::create(['studio_id' => $studio->id, 'first_name' => 'Holly', 'email' => $email]);
    $project = Project::create(['studio_id' => $studio->id, 'contact_id' => $contact->id, 'name' => 'Holly Wedding']);

    $contract = Contract::create(['studio_id' => $studio->id, 'project_id' => $project->id, 'contact_id' => $contact->id, 'title' => 'Wedding Contract', 'body' => 'Terms', 'status' => 'draft']);
    $invoice = Invoice::create(['studio_id' => $studio->id, 'project_id' => $project->id, 'contact_id' => $contact->id, 'number' => 'INV-1', 'status' => 'draft', 'currency' => 'gbp']);

    $proposal = Proposal::create([
        'studio_id' => $studio->id, 'project_id' => $project->id, 'contact_id' => $contact->id,
        'title' => 'Wedding proposal', 'status' => 'draft', 'contract_id' => $contract->id, 'invoice_id' => $invoice->id,
    ]);

    return [$studio, $user, $proposal, $contract, $invoice];
}

it('emails the proposal to the client and sends the bundled docs', function () {
    Mail::fake();
    [, $user, $proposal, $contract, $invoice] = proposalSetup();

    $this->actingAs($user)->post(route('proposals.send', $proposal->id))->assertRedirect();

    Mail::assertSent(ClientMessage::class, fn (ClientMessage $m) => $m->hasTo('holly@example.com'));

    expect($proposal->fresh()->status)->toBe('sent')
        ->and($contract->fresh()->status)->toBe('sent')   // bundled docs flipped too
        ->and($invoice->fresh()->status)->toBe('sent')
        ->and(ClientEmail::where('emailable_id', $proposal->id)->where('status', 'sent')->exists())->toBeTrue();
});

it('re-sends a proposal that was already sent', function () {
    Mail::fake();
    [, $user, $proposal] = proposalSetup();
    $proposal->update(['status' => 'sent', 'sent_at' => now()]);

    $this->actingAs($user)->post(route('proposals.send', $proposal->id))->assertRedirect()->assertSessionHas('success');

    Mail::assertSent(ClientMessage::class);
});

it('refuses to send when the client has no email', function () {
    Mail::fake();
    [, $user, $proposal] = proposalSetup(email: null);

    $this->actingAs($user)->post(route('proposals.send', $proposal->id))
        ->assertRedirect()
        ->assertSessionHas('error');

    Mail::assertNothingSent();
    expect($proposal->fresh()->status)->toBe('draft');
});
