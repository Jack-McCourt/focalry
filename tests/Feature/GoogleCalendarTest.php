<?php

use App\Models\Meeting;
use App\Models\MeetingType;
use App\Models\Studio;
use App\Models\User;
use App\Services\GoogleCalendarService;
use Illuminate\Support\Facades\Http;

function connectedStudio(array $bundle = []): Studio
{
    $studio = Studio::factory()->create([
        'google_calendar' => array_merge([
            'access_token' => 'valid-token',
            'refresh_token' => 'refresh-token',
            'expires_at' => now()->addHour()->toIso8601String(),
            'calendar_id' => 'primary',
        ], $bundle),
        'google_calendar_email' => 'studio@example.com',
    ]);
    app()->instance('current.studio.id', $studio->id);

    return $studio;
}

function meetingFor(Studio $studio, string $locationType = 'video', string $provider = 'google_meet'): Meeting
{
    $type = MeetingType::create([
        'studio_id' => $studio->id, 'name' => 'Consult', 'duration_minutes' => 30,
        'price_cents' => 0, 'currency' => 'usd', 'location_type' => $locationType, 'video_provider' => $provider, 'buffer_minutes' => 0, 'min_lead_hours' => 0,
    ]);

    return Meeting::create([
        'studio_id' => $studio->id, 'meeting_type_id' => $type->id,
        'client_name' => 'Dana Lee', 'client_email' => 'dana@example.com',
        'starts_at' => now()->addDays(3), 'ends_at' => now()->addDays(3)->addMinutes(30),
        'status' => 'confirmed', 'price_cents' => 0, 'currency' => 'usd',
    ]);
}

it('creates a calendar event with a Meet link for a video meeting and invites both parties', function () {
    Http::fake([
        'www.googleapis.com/*' => Http::response(['id' => 'evt_123', 'hangoutLink' => 'https://meet.google.com/abc-defg-hij'], 200),
    ]);

    $studio = connectedStudio();
    $meeting = meetingFor($studio, 'video', 'google_meet');

    app(GoogleCalendarService::class)->syncMeeting($meeting);

    expect($meeting->refresh()->google_event_id)->toBe('evt_123')
        ->and($meeting->meeting_url)->toBe('https://meet.google.com/abc-defg-hij');

    Http::assertSent(function ($request) {
        return str_contains($request->url(), 'conferenceDataVersion=1')
            && str_contains($request->url(), 'sendUpdates=all')
            && data_get($request->data(), 'conferenceData.createRequest.conferenceSolutionKey.type') === 'hangoutsMeet'
            && data_get($request->data(), 'attendees.0.email') === 'dana@example.com';
    });
});

it('does not request a Meet link when the provider is Zoom', function () {
    Http::fake(['www.googleapis.com/*' => Http::response(['id' => 'evt_x'], 200)]);

    $studio = connectedStudio();
    $meeting = meetingFor($studio, 'video', 'zoom');

    app(GoogleCalendarService::class)->syncMeeting($meeting);

    Http::assertSent(fn ($request) => ! array_key_exists('conferenceData', (array) $request->data()));
});

it('refreshes an expired access token before syncing', function () {
    Http::fake([
        'oauth2.googleapis.com/token' => Http::response(['access_token' => 'fresh-token', 'expires_in' => 3600], 200),
        'www.googleapis.com/*' => Http::response(['id' => 'evt_r'], 200),
    ]);

    $studio = connectedStudio(['access_token' => 'stale', 'expires_at' => now()->subHour()->toIso8601String()]);
    $meeting = meetingFor($studio);

    app(GoogleCalendarService::class)->syncMeeting($meeting);

    expect($studio->refresh()->google_calendar['access_token'])->toBe('fresh-token');
    Http::assertSent(fn ($request) => str_contains($request->url(), 'oauth2.googleapis.com/token'));
});

it('skips syncing when the studio has no calendar connected', function () {
    Http::fake();
    $studio = Studio::factory()->create(['google_calendar' => null]);
    app()->instance('current.studio.id', $studio->id);
    $meeting = meetingFor($studio);

    app(GoogleCalendarService::class)->syncMeeting($meeting);

    Http::assertNothingSent();
    expect($meeting->refresh()->google_event_id)->toBeNull();
});

it('deletes the calendar event when a meeting is removed', function () {
    Http::fake(['www.googleapis.com/*' => Http::response([], 204)]);

    $studio = connectedStudio();
    $meeting = meetingFor($studio);
    $meeting->forceFill(['google_event_id' => 'evt_del'])->save();

    app(GoogleCalendarService::class)->removeMeeting($meeting);

    expect($meeting->refresh()->google_event_id)->toBeNull();
    Http::assertSent(fn ($request) => $request->method() === 'DELETE' && str_contains($request->url(), 'events/evt_del'));
});

it('syncs to the calendar when the studio confirms a meeting', function () {
    Http::fake(['www.googleapis.com/*' => Http::response(['id' => 'evt_confirm'], 200)]);

    $studio = connectedStudio();
    $user = User::factory()->for($studio)->create();
    $meeting = meetingFor($studio);
    $meeting->update(['status' => 'pending']);

    $this->actingAs($user)->post(route('meetings.confirm', $meeting))->assertRedirect();

    expect($meeting->refresh()->status)->toBe('confirmed')
        ->and($meeting->google_event_id)->toBe('evt_confirm');
});
