<?php

use App\Models\Booking;
use App\Models\SessionType;
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

function bookingFor(Studio $studio, string $locationType = 'video'): Booking
{
    $type = SessionType::create([
        'studio_id' => $studio->id, 'name' => 'Consult', 'duration_minutes' => 30,
        'price_cents' => 0, 'currency' => 'usd', 'location_type' => $locationType, 'buffer_minutes' => 0, 'min_lead_hours' => 0,
    ]);

    return Booking::create([
        'studio_id' => $studio->id, 'session_type_id' => $type->id,
        'client_name' => 'Dana Lee', 'client_email' => 'dana@example.com',
        'starts_at' => now()->addDays(3), 'ends_at' => now()->addDays(3)->addMinutes(30),
        'status' => 'confirmed', 'price_cents' => 0, 'currency' => 'usd',
    ]);
}

it('creates a calendar event with a Meet link for a video booking', function () {
    Http::fake([
        'www.googleapis.com/*' => Http::response(['id' => 'evt_123', 'hangoutLink' => 'https://meet.google.com/abc-defg-hij'], 200),
    ]);

    $studio = connectedStudio();
    $booking = bookingFor($studio, 'video');

    app(GoogleCalendarService::class)->syncBooking($booking);

    expect($booking->refresh()->google_event_id)->toBe('evt_123')
        ->and($booking->meeting_url)->toBe('https://meet.google.com/abc-defg-hij');

    Http::assertSent(function ($request) {
        return str_contains($request->url(), 'conferenceDataVersion=1')
            && data_get($request->data(), 'conferenceData.createRequest.conferenceSolutionKey.type') === 'hangoutsMeet';
    });
});

it('does not request a Meet link for an in-person booking', function () {
    Http::fake(['www.googleapis.com/*' => Http::response(['id' => 'evt_x'], 200)]);

    $studio = connectedStudio();
    $booking = bookingFor($studio, 'in_person');

    app(GoogleCalendarService::class)->syncBooking($booking);

    Http::assertSent(fn ($request) => ! array_key_exists('conferenceData', (array) $request->data()));
});

it('refreshes an expired access token before syncing', function () {
    Http::fake([
        'oauth2.googleapis.com/token' => Http::response(['access_token' => 'fresh-token', 'expires_in' => 3600], 200),
        'www.googleapis.com/*' => Http::response(['id' => 'evt_r'], 200),
    ]);

    $studio = connectedStudio(['access_token' => 'stale', 'expires_at' => now()->subHour()->toIso8601String()]);
    $booking = bookingFor($studio);

    app(GoogleCalendarService::class)->syncBooking($booking);

    expect($studio->refresh()->google_calendar['access_token'])->toBe('fresh-token');
    Http::assertSent(fn ($request) => str_contains($request->url(), 'oauth2.googleapis.com/token'));
});

it('skips syncing when the studio has no calendar connected', function () {
    Http::fake();
    $studio = Studio::factory()->create(['google_calendar' => null]);
    app()->instance('current.studio.id', $studio->id);
    $booking = bookingFor($studio);

    app(GoogleCalendarService::class)->syncBooking($booking);

    Http::assertNothingSent();
    expect($booking->refresh()->google_event_id)->toBeNull();
});

it('deletes the calendar event when a booking is removed', function () {
    Http::fake(['www.googleapis.com/*' => Http::response([], 204)]);

    $studio = connectedStudio();
    $booking = bookingFor($studio);
    $booking->forceFill(['google_event_id' => 'evt_del'])->save();

    app(GoogleCalendarService::class)->removeBooking($booking);

    expect($booking->refresh()->google_event_id)->toBeNull();
    Http::assertSent(fn ($request) => $request->method() === 'DELETE' && str_contains($request->url(), 'events/evt_del'));
});

it('syncs to the calendar when the studio confirms a booking', function () {
    Http::fake(['www.googleapis.com/*' => Http::response(['id' => 'evt_confirm'], 200)]);

    $studio = connectedStudio();
    $user = User::factory()->for($studio)->create();
    $booking = bookingFor($studio);
    $booking->update(['status' => 'pending']);

    $this->actingAs($user)->post(route('bookings.confirm', $booking))->assertRedirect();

    expect($booking->refresh()->status)->toBe('confirmed')
        ->and($booking->google_event_id)->toBe('evt_confirm');
});
