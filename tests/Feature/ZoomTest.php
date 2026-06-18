<?php

use App\Models\Meeting;
use App\Models\MeetingType;
use App\Models\Studio;
use App\Services\MeetingScheduler;
use App\Services\ZoomService;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config(['services.zoom.client_id' => 'zoom-id', 'services.zoom.client_secret' => 'zoom-secret']);
});

function zoomStudio(array $bundle = []): Studio
{
    $studio = Studio::factory()->create([
        'zoom' => array_merge([
            'access_token' => 'zoom-access',
            'refresh_token' => 'zoom-refresh',
            'expires_at' => now()->addHour()->toIso8601String(),
        ], $bundle),
        'zoom_email' => 'studio@example.com',
    ]);
    app()->instance('current.studio.id', $studio->id);

    return $studio;
}

function zoomMeeting(Studio $studio, string $provider = 'zoom'): Meeting
{
    $type = MeetingType::create([
        'studio_id' => $studio->id, 'name' => 'Discovery', 'duration_minutes' => 30,
        'location_type' => 'video', 'video_provider' => $provider, 'buffer_minutes' => 0, 'min_lead_hours' => 0,
    ]);

    return Meeting::create([
        'studio_id' => $studio->id, 'meeting_type_id' => $type->id,
        'client_name' => 'Dana Lee', 'client_email' => 'dana@example.com',
        'starts_at' => now()->addDays(2), 'ends_at' => now()->addDays(2)->addMinutes(30),
        'status' => 'confirmed',
    ]);
}

it('creates a Zoom meeting and stores the join URL', function () {
    Http::fake([
        'api.zoom.us/v2/users/me/meetings' => Http::response(['id' => 99001122, 'join_url' => 'https://zoom.us/j/99001122'], 201),
    ]);

    $studio = zoomStudio();
    $meeting = zoomMeeting($studio);

    app(ZoomService::class)->syncMeeting($meeting);

    expect($meeting->refresh()->zoom_meeting_id)->toBe('99001122')
        ->and($meeting->meeting_url)->toBe('https://zoom.us/j/99001122');

    Http::assertSent(fn ($request) => str_contains($request->url(), 'users/me/meetings')
        && data_get($request->data(), 'type') === 2);
});

it('refreshes a rotated Zoom token before creating the meeting', function () {
    Http::fake([
        'zoom.us/oauth/token' => Http::response(['access_token' => 'new-access', 'refresh_token' => 'rotated-refresh', 'expires_in' => 3600], 200),
        'api.zoom.us/*' => Http::response(['id' => 1, 'join_url' => 'https://zoom.us/j/1'], 201),
    ]);

    $studio = zoomStudio(['access_token' => 'stale', 'expires_at' => now()->subHour()->toIso8601String()]);
    $meeting = zoomMeeting($studio);

    app(ZoomService::class)->syncMeeting($meeting);

    // Zoom rotates the refresh token — make sure we persisted the new one.
    expect($studio->refresh()->zoom['refresh_token'])->toBe('rotated-refresh');
});

it('skips Zoom when the studio is not connected', function () {
    Http::fake();
    $studio = Studio::factory()->create(['zoom' => null]);
    app()->instance('current.studio.id', $studio->id);
    $meeting = zoomMeeting($studio);

    app(ZoomService::class)->syncMeeting($meeting);

    Http::assertNothingSent();
    expect($meeting->refresh()->zoom_meeting_id)->toBeNull();
});

it('deletes the Zoom meeting when removed', function () {
    Http::fake(['api.zoom.us/*' => Http::response([], 204)]);

    $studio = zoomStudio();
    $meeting = zoomMeeting($studio);
    $meeting->forceFill(['zoom_meeting_id' => '555'])->save();

    app(ZoomService::class)->removeMeeting($meeting);

    expect($meeting->refresh()->zoom_meeting_id)->toBeNull();
    Http::assertSent(fn ($request) => $request->method() === 'DELETE' && str_contains($request->url(), 'meetings/555'));
});

it('scheduler creates a Zoom link then a calendar event carrying it', function () {
    Http::fake([
        'api.zoom.us/v2/users/me/meetings' => Http::response(['id' => 42, 'join_url' => 'https://zoom.us/j/42'], 201),
        'www.googleapis.com/*' => Http::response(['id' => 'evt_z'], 200),
    ]);

    $studio = zoomStudio();
    // Also connect Google Calendar so the scheduler syncs the event.
    $studio->update(['google_calendar' => [
        'access_token' => 'ga', 'refresh_token' => 'gr', 'expires_at' => now()->addHour()->toIso8601String(), 'calendar_id' => 'primary',
    ]]);
    $meeting = zoomMeeting($studio, 'zoom');

    app(MeetingScheduler::class)->sync($meeting);

    expect($meeting->refresh()->meeting_url)->toBe('https://zoom.us/j/42');

    // The calendar event should NOT request a Meet link and should carry the Zoom URL.
    Http::assertSent(function ($request) {
        if (! str_contains($request->url(), 'googleapis.com')) {
            return false;
        }

        return ! array_key_exists('conferenceData', (array) $request->data())
            && str_contains((string) data_get($request->data(), 'location'), 'zoom.us/j/42');
    });
});
