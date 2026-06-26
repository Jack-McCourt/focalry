<?php

use App\Mail\ProjectShareCode;
use App\Models\Project;
use App\Models\ProjectShare;
use App\Models\Studio;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

function makeShare(): ProjectShare
{
    $studio = Studio::factory()->create();
    app()->instance('current.studio.id', $studio->id);
    $project = Project::create(['studio_id' => $studio->id, 'name' => 'Holly & Daniel Wedding']);

    return ProjectShare::create([
        'studio_id' => $studio->id,
        'project_id' => $project->id,
        'email' => 'guest@example.com',
    ]);
}

it('shows the verification gate, not the details, on first visit', function () {
    $share = makeShare();

    $this->get(route('projects.public.show', $share->token))
        ->assertInertia(fn (AssertableInertia $p) => $p->component('Public/ProjectShareVerify')
            ->where('masked_email', 'g••••@example.com'));
});

it('emails a one-time code and verifies it to unlock the details', function () {
    Mail::fake();
    $share = makeShare();

    $this->post(route('projects.public.code', $share->token))->assertRedirect();

    $code = null;
    Mail::assertSent(ProjectShareCode::class, function (ProjectShareCode $m) use (&$code) {
        $code = $m->code;

        return $m->hasTo('guest@example.com');
    });

    // Wrong code is rejected.
    $this->post(route('projects.public.verify', $share->token), ['code' => '000000'])
        ->assertSessionHasErrors('code');

    // Correct code unlocks and is remembered for the session.
    $this->post(route('projects.public.verify', $share->token), ['code' => $code])
        ->assertRedirect(route('projects.public.show', $share->token));

    $this->get(route('projects.public.show', $share->token))
        ->assertInertia(fn (AssertableInertia $p) => $p->component('Public/ProjectShare')
            ->where('project.name', 'Holly & Daniel Wedding'));

    expect($share->fresh()->last_viewed_at)->not->toBeNull();
});

it('keeps the access code valid for repeated use', function () {
    $share = makeShare();

    expect($share->code)->toMatch('/^\d{6}$/')
        ->and($share->checkCode($share->code))->toBeTrue()
        ->and($share->checkCode($share->code))->toBeTrue() // not one-time — still valid
        ->and($share->checkCode('000000'))->toBeFalse();
});

it('404s an unknown token', function () {
    $this->get(route('projects.public.show', 'nope-not-a-real-token'))->assertNotFound();
});
