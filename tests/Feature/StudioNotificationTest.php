<?php

use App\Models\Questionnaire;
use App\Models\Studio;
use App\Models\User;
use App\Notifications\StudioEvent;
use App\Support\StudioNotifications;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

it('emails by default but respects a per-user opt-out, always keeping the bell', function () {
    Notification::fake();
    $studio = Studio::factory()->create();
    app()->instance('current.studio.id', $studio->id);

    $wantsEmail = User::factory()->for($studio)->create();
    $optedOut = User::factory()->for($studio)->create(['notification_preferences' => ['invoice_paid' => false]]);

    StudioNotifications::send($studio->id, 'invoice_paid', 'Invoice paid', 'Holly paid £300.', '/invoices/1');

    Notification::assertSentTo($wantsEmail, StudioEvent::class, function ($n, $channels) {
        return in_array('database', $channels, true) && in_array('mail', $channels, true);
    });
    Notification::assertSentTo($optedOut, StudioEvent::class, function ($n, $channels) {
        return $channels === ['database']; // bell only, no email
    });
});

it('does not leak notifications across studios', function () {
    Notification::fake();
    $a = Studio::factory()->create();
    $b = Studio::factory()->create();
    app()->instance('current.studio.id', $a->id);
    $userA = User::factory()->for($a)->create();
    $userB = User::factory()->for($b)->create();

    StudioNotifications::send($a->id, 'contract_signed', 'Contract signed', 'Signed.', '/c/1');

    Notification::assertSentTo($userA, StudioEvent::class);
    Notification::assertNotSentTo($userB, StudioEvent::class);
});

it('writes a notification to the bell and lists it in the inbox', function () {
    Mail::fake();
    $studio = Studio::factory()->create();
    app()->instance('current.studio.id', $studio->id);
    $user = User::factory()->for($studio)->create();

    $user->notify(new StudioEvent('meeting_booked', 'Meeting booked', 'Sam booked a call.', '/meetings'));

    expect($user->notifications()->count())->toBe(1)
        ->and($user->unreadNotifications()->count())->toBe(1);

    $this->actingAs($user)->get(route('notifications.index'))
        ->assertInertia(fn (AssertableInertia $p) => $p->component('Notifications/Index')
            ->where('unread_total', 1)
            ->has('notifications.data', 1)
            ->where('notifications.data.0.title', 'Meeting booked')
            ->where('notifications.data.0.type', 'meeting_booked'));
});

it('saves notification email preferences', function () {
    $studio = Studio::factory()->create();
    app()->instance('current.studio.id', $studio->id);
    $user = User::factory()->for($studio)->create();

    $this->actingAs($user)->patch(route('profile.notifications'), [
        'preferences' => ['invoice_paid' => false, 'contract_signed' => true, 'bogus_type' => true],
    ])->assertRedirect();

    $user->refresh();
    expect($user->wantsEmail('invoice_paid'))->toBeFalse()
        ->and($user->wantsEmail('contract_signed'))->toBeTrue()
        // unknown keys are ignored; unset known types fall back to their default (true)
        ->and($user->notification_preferences)->not->toHaveKey('bogus_type')
        ->and($user->wantsEmail('meeting_booked'))->toBeTrue();
});

it('raises a notification when a client completes a questionnaire', function () {
    Notification::fake();
    $studio = Studio::factory()->create();
    app()->instance('current.studio.id', $studio->id);
    $user = User::factory()->for($studio)->create();

    $q = Questionnaire::create([
        'studio_id' => $studio->id,
        'title' => 'Wedding details',
        'status' => 'sent',
        'questions' => [],
    ]);

    $this->post(route('questionnaires.public.submit', $q->public_id), ['answers' => []])->assertRedirect();

    Notification::assertSentTo($user, StudioEvent::class, fn ($n) => $n->type === 'questionnaire_submitted');
});
