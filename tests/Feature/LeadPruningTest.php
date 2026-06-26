<?php

use App\Models\Contact;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\Studio;
use App\Models\User;

function leadSetup(array $leadSettings = ['enabled' => true, 'value' => 1, 'unit' => 'months']): array
{
    $studio = Studio::factory()->onPaidPlan('plus')->create(['lead_settings' => $leadSettings]);
    $user = User::factory()->for($studio)->create();
    app()->instance('current.studio.id', $studio->id);

    ProjectStatus::seedDefaults();
    $lead = ProjectStatus::where('label', 'Lead')->first();
    $contact = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'first_name' => 'Jane', 'email' => 'jane@example.com',
    ]);

    return [$studio, $user, $lead, $contact];
}

it('soft-deletes leads that have sat in the Lead status past the window', function () {
    [$studio, , $lead, $contact] = leadSetup();

    $stale = Project::create(['studio_id' => $studio->id, 'name' => 'Old enquiry', 'contact_id' => $contact->id, 'status_id' => $lead->id]);
    $stale->forceFill(['status_changed_at' => now()->subMonths(2)])->save();

    $fresh = Project::create(['studio_id' => $studio->id, 'name' => 'New enquiry', 'contact_id' => $contact->id, 'status_id' => $lead->id]);

    $this->artisan('leads:prune')->assertSuccessful();

    expect(Project::withTrashed()->find($stale->id)->trashed())->toBeTrue();
    expect($fresh->fresh()->trashed())->toBeFalse();
});

it('does not delete leads when the setting is off', function () {
    [$studio, , $lead, $contact] = leadSetup(['enabled' => false, 'value' => 1, 'unit' => 'months']);

    $p = Project::create(['studio_id' => $studio->id, 'name' => 'Old enquiry', 'contact_id' => $contact->id, 'status_id' => $lead->id]);
    $p->forceFill(['status_changed_at' => now()->subYears(1)])->save();

    $this->artisan('leads:prune')->assertSuccessful();

    expect($p->fresh()->trashed())->toBeFalse();
});

it('resets the clock when a project moves out of the Lead status', function () {
    [$studio, $user, $lead, $contact] = leadSetup();
    $booked = ProjectStatus::where('label', '!=', 'Lead')->orderBy('position')->first();

    $p = Project::create(['studio_id' => $studio->id, 'name' => 'Enquiry', 'contact_id' => $contact->id, 'status_id' => $lead->id]);
    $p->forceFill(['status_changed_at' => now()->subMonths(2)])->save();

    // Move it out of Lead — status_changed_at should refresh, removing it from the window.
    $this->actingAs($user)->patch(route('projects.update', $p->id), ['status_id' => $booked->id])->assertRedirect();

    $this->artisan('leads:prune')->assertSuccessful();

    expect($p->fresh()->trashed())->toBeFalse();
});

it('permanently removes projects trashed beyond the retention window', function () {
    [$studio, , $lead, $contact] = leadSetup(['enabled' => false, 'value' => 1, 'unit' => 'months']);

    $p = Project::create(['studio_id' => $studio->id, 'name' => 'Gone', 'contact_id' => $contact->id, 'status_id' => $lead->id]);
    $p->delete();
    $p->forceFill(['deleted_at' => now()->subDays(40)])->save();

    $this->artisan('leads:prune')->assertSuccessful();

    expect(Project::withTrashed()->find($p->id))->toBeNull();
});

it('restores and force-deletes from the trash page', function () {
    [$studio, $user, $lead, $contact] = leadSetup();
    $p = Project::create(['studio_id' => $studio->id, 'name' => 'Trashed', 'contact_id' => $contact->id, 'status_id' => $lead->id]);
    $p->delete();

    $this->actingAs($user)->get(route('projects.trash'))->assertOk();

    $this->actingAs($user)->post(route('projects.restore', $p->id))->assertRedirect();
    expect($p->fresh()->trashed())->toBeFalse();

    $p->delete();
    $this->actingAs($user)->delete(route('projects.force-destroy', $p->id))->assertRedirect();
    expect(Project::withTrashed()->find($p->id))->toBeNull();
});
