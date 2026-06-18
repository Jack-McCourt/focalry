<?php

namespace App\Services;

use App\Models\Meeting;
use App\Models\Studio;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Thin wrapper over the Google Calendar REST API. Uses the per-studio OAuth
 * token stored on Studio::$google_calendar, refreshing the access token as
 * needed. All failures are logged and swallowed — calendar sync must never
 * break the meeting flow.
 */
class GoogleCalendarService
{
    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    private const API = 'https://www.googleapis.com/calendar/v3';

    /** Create (or recreate) the calendar event for a meeting and store its id + Meet link. */
    public function syncMeeting(Meeting $meeting): void
    {
        $studio = Studio::find($meeting->studio_id);
        if (! $studio?->googleCalendarConnected()) {
            return;
        }

        $token = $this->accessToken($studio);
        if (! $token) {
            return;
        }

        $calendarId = $studio->google_calendar['calendar_id'] ?? 'primary';
        $type = $meeting->meetingType;
        // Only Google Meet auto-generates a link; Zoom links are added separately.
        $wantsMeet = $type?->location_type === 'video' && ($type->video_provider ?? 'google_meet') === 'google_meet';

        $payload = [
            'summary' => trim(($type?->name ?? 'Meeting').' — '.$meeting->client_name),
            'description' => $meeting->notes ?: null,
            'start' => ['dateTime' => $meeting->starts_at->toRfc3339String(), 'timeZone' => config('app.timezone')],
            'end' => ['dateTime' => $meeting->ends_at->toRfc3339String(), 'timeZone' => config('app.timezone')],
            // Inviting the client as an attendee makes Google email them the invite.
            'attendees' => [['email' => $meeting->client_email, 'displayName' => $meeting->client_name]],
        ];

        if ($meeting->location) {
            $payload['location'] = $meeting->location;
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
            $existing = $meeting->google_event_id;
            $base = Http::withToken($token)->acceptJson();
            // sendUpdates=all → Google emails the invite/update to both parties.
            $query = 'conferenceDataVersion=1&sendUpdates=all';

            $response = $existing
                ? $base->put(self::API."/calendars/{$calendarId}/events/{$existing}?{$query}", $payload)
                : $base->post(self::API."/calendars/{$calendarId}/events?{$query}", $payload);

            if ($response->failed()) {
                Log::warning('Google Calendar sync failed', ['meeting' => $meeting->id, 'body' => $response->body()]);

                return;
            }

            $event = $response->json();
            $meeting->forceFill([
                'google_event_id' => $event['id'] ?? $existing,
                'meeting_url' => $event['hangoutLink'] ?? $meeting->meeting_url,
            ])->saveQuietly();
        } catch (\Throwable $e) {
            Log::warning('Google Calendar sync error', ['meeting' => $meeting->id, 'error' => $e->getMessage()]);
        }
    }

    /** Remove the calendar event for a meeting, if one exists. */
    public function removeMeeting(Meeting $meeting): void
    {
        $studio = Studio::find($meeting->studio_id);
        if (! $studio?->googleCalendarConnected() || ! $meeting->google_event_id) {
            return;
        }

        $token = $this->accessToken($studio);
        if (! $token) {
            return;
        }

        $calendarId = $studio->google_calendar['calendar_id'] ?? 'primary';

        try {
            Http::withToken($token)->delete(self::API."/calendars/{$calendarId}/events/{$meeting->google_event_id}?sendUpdates=all");
            $meeting->forceFill(['google_event_id' => null])->saveQuietly();
        } catch (\Throwable $e) {
            Log::warning('Google Calendar delete error', ['meeting' => $meeting->id, 'error' => $e->getMessage()]);
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
