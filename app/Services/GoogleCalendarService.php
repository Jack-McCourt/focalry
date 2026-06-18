<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Studio;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Thin wrapper over the Google Calendar REST API. Uses the per-studio OAuth
 * token stored on Studio::$google_calendar, refreshing the access token as
 * needed. All failures are logged and swallowed — calendar sync must never
 * break the booking flow.
 */
class GoogleCalendarService
{
    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    private const API = 'https://www.googleapis.com/calendar/v3';

    /** Create (or recreate) the calendar event for a booking and store its id + Meet link. */
    public function syncBooking(Booking $booking): void
    {
        $studio = Studio::find($booking->studio_id);
        if (! $studio?->googleCalendarConnected()) {
            return;
        }

        $token = $this->accessToken($studio);
        if (! $token) {
            return;
        }

        $calendarId = $studio->google_calendar['calendar_id'] ?? 'primary';
        $wantsMeet = $booking->sessionType?->location_type === 'video';

        $payload = [
            'summary' => trim(($booking->sessionType?->name ?? 'Session').' — '.$booking->client_name),
            'description' => $booking->notes ?: null,
            'start' => ['dateTime' => $booking->starts_at->toRfc3339String(), 'timeZone' => config('app.timezone')],
            'end' => ['dateTime' => $booking->ends_at->toRfc3339String(), 'timeZone' => config('app.timezone')],
            'attendees' => [['email' => $booking->client_email, 'displayName' => $booking->client_name]],
        ];

        if ($booking->location) {
            $payload['location'] = $booking->location;
        }

        if ($wantsMeet) {
            $payload['conferenceData'] = [
                'createRequest' => [
                    'requestId' => (string) Str::uuid(),
                    'conferenceSolutionKey' => ['type' => 'hangoutsMeet'],
                ],
            ];
        }

        try {
            $existing = $booking->google_event_id;
            $base = Http::withToken($token)->acceptJson();

            $response = $existing
                ? $base->put(self::API."/calendars/{$calendarId}/events/{$existing}?conferenceDataVersion=1", $payload)
                : $base->post(self::API."/calendars/{$calendarId}/events?conferenceDataVersion=1", $payload);

            if ($response->failed()) {
                Log::warning('Google Calendar sync failed', ['booking' => $booking->id, 'body' => $response->body()]);

                return;
            }

            $event = $response->json();
            $booking->forceFill([
                'google_event_id' => $event['id'] ?? $existing,
                'meeting_url' => $event['hangoutLink'] ?? $booking->meeting_url,
            ])->saveQuietly();
        } catch (\Throwable $e) {
            Log::warning('Google Calendar sync error', ['booking' => $booking->id, 'error' => $e->getMessage()]);
        }
    }

    /** Remove the calendar event for a booking, if one exists. */
    public function removeBooking(Booking $booking): void
    {
        $studio = Studio::find($booking->studio_id);
        if (! $studio?->googleCalendarConnected() || ! $booking->google_event_id) {
            return;
        }

        $token = $this->accessToken($studio);
        if (! $token) {
            return;
        }

        $calendarId = $studio->google_calendar['calendar_id'] ?? 'primary';

        try {
            Http::withToken($token)->delete(self::API."/calendars/{$calendarId}/events/{$booking->google_event_id}");
            $booking->forceFill(['google_event_id' => null])->saveQuietly();
        } catch (\Throwable $e) {
            Log::warning('Google Calendar delete error', ['booking' => $booking->id, 'error' => $e->getMessage()]);
        }
    }

    /** A valid access token, refreshing and persisting it when expired. */
    public function accessToken(Studio $studio): ?string
    {
        $bundle = $studio->google_calendar ?? [];
        $expiresAt = isset($bundle['expires_at']) ? Carbon::parse($bundle['expires_at']) : null;

        if (! empty($bundle['access_token']) && $expiresAt && $expiresAt->isFuture()) {
            return $bundle['access_token'];
        }

        if (empty($bundle['refresh_token'])) {
            return null;
        }

        try {
            $response = Http::asForm()->post(self::TOKEN_URL, [
                'client_id' => config('services.google.client_id'),
                'client_secret' => config('services.google.client_secret'),
                'refresh_token' => $bundle['refresh_token'],
                'grant_type' => 'refresh_token',
            ]);

            if ($response->failed()) {
                Log::warning('Google token refresh failed', ['studio' => $studio->id, 'body' => $response->body()]);

                return null;
            }

            $data = $response->json();
            $bundle['access_token'] = $data['access_token'];
            $bundle['expires_at'] = now()->addSeconds(($data['expires_in'] ?? 3600) - 30)->toIso8601String();
            $studio->forceFill(['google_calendar' => $bundle])->saveQuietly();

            return $bundle['access_token'];
        } catch (\Throwable $e) {
            Log::warning('Google token refresh error', ['studio' => $studio->id, 'error' => $e->getMessage()]);

            return null;
        }
    }
}
