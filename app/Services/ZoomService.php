<?php

namespace App\Services;

use App\Models\Meeting;
use App\Models\Studio;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Per-studio Zoom integration (user-managed OAuth). Creates a scheduled Zoom
 * meeting and stores its join URL on the meeting. All failures are logged and
 * swallowed so Zoom problems never break the meeting flow.
 */
class ZoomService
{
    private const OAUTH_TOKEN = 'https://zoom.us/oauth/token';

    private const API = 'https://api.zoom.us/v2';

    /** Exchange an authorization code for a token bundle. */
    public function exchangeCode(string $code, string $redirectUri): ?array
    {
        try {
            $response = $this->basicAuth()->asForm()->post(self::OAUTH_TOKEN, [
                'grant_type' => 'authorization_code',
                'code' => $code,
                'redirect_uri' => $redirectUri,
            ]);

            if ($response->failed()) {
                Log::warning('Zoom code exchange failed', ['body' => $response->body()]);

                return null;
            }

            return $this->bundleFrom($response->json());
        } catch (\Throwable $e) {
            Log::warning('Zoom code exchange error', ['error' => $e->getMessage()]);

            return null;
        }
    }

    public function accountEmail(string $accessToken): ?string
    {
        try {
            $response = Http::withToken($accessToken)->acceptJson()->get(self::API.'/users/me');

            return $response->ok() ? ($response->json('email') ?: null) : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Create (or update) the Zoom meeting for a booking and store its join URL. */
    public function syncMeeting(Meeting $meeting): void
    {
        $studio = Studio::find($meeting->studio_id);
        if (! $studio?->zoomConnected()) {
            return;
        }

        $token = $this->accessToken($studio);
        if (! $token) {
            return;
        }

        $payload = [
            'topic' => trim(($meeting->meetingType?->name ?? 'Meeting').' — '.$meeting->client_name),
            'type' => 2, // scheduled meeting
            'start_time' => $meeting->starts_at->copy()->setTimezone(config('app.timezone'))->format('Y-m-d\TH:i:s'),
            'duration' => max(1, $meeting->starts_at->diffInMinutes($meeting->ends_at)),
            'timezone' => config('app.timezone'),
            'settings' => ['join_before_host' => true, 'waiting_room' => false],
        ];

        try {
            if ($meeting->zoom_meeting_id) {
                Http::withToken($token)->acceptJson()->patch(self::API."/meetings/{$meeting->zoom_meeting_id}", $payload);

                return;
            }

            $response = Http::withToken($token)->acceptJson()->post(self::API.'/users/me/meetings', $payload);

            if ($response->failed()) {
                Log::warning('Zoom meeting create failed', ['meeting' => $meeting->id, 'body' => $response->body()]);

                return;
            }

            $data = $response->json();
            $meeting->forceFill([
                'zoom_meeting_id' => (string) ($data['id'] ?? ''),
                'meeting_url' => $data['join_url'] ?? $meeting->meeting_url,
            ])->saveQuietly();
        } catch (\Throwable $e) {
            Log::warning('Zoom meeting sync error', ['meeting' => $meeting->id, 'error' => $e->getMessage()]);
        }
    }

    public function removeMeeting(Meeting $meeting): void
    {
        $studio = Studio::find($meeting->studio_id);
        if (! $studio?->zoomConnected() || ! $meeting->zoom_meeting_id) {
            return;
        }

        $token = $this->accessToken($studio);
        if (! $token) {
            return;
        }

        try {
            Http::withToken($token)->delete(self::API."/meetings/{$meeting->zoom_meeting_id}");
            $meeting->forceFill(['zoom_meeting_id' => null])->saveQuietly();
        } catch (\Throwable $e) {
            Log::warning('Zoom meeting delete error', ['meeting' => $meeting->id, 'error' => $e->getMessage()]);
        }
    }

    /** A valid access token, refreshing and persisting it (Zoom rotates refresh tokens). */
    public function accessToken(Studio $studio): ?string
    {
        $bundle = $studio->zoom ?? [];
        $expiresAt = isset($bundle['expires_at']) ? Carbon::parse($bundle['expires_at']) : null;

        if (! empty($bundle['access_token']) && $expiresAt && $expiresAt->isFuture()) {
            return $bundle['access_token'];
        }

        if (empty($bundle['refresh_token'])) {
            return null;
        }

        try {
            $response = $this->basicAuth()->asForm()->post(self::OAUTH_TOKEN, [
                'grant_type' => 'refresh_token',
                'refresh_token' => $bundle['refresh_token'],
            ]);

            if ($response->failed()) {
                Log::warning('Zoom token refresh failed', ['studio' => $studio->id, 'body' => $response->body()]);

                return null;
            }

            $fresh = $this->bundleFrom($response->json());
            $studio->forceFill(['zoom' => $fresh])->saveQuietly();

            return $fresh['access_token'];
        } catch (\Throwable $e) {
            Log::warning('Zoom token refresh error', ['studio' => $studio->id, 'error' => $e->getMessage()]);

            return null;
        }
    }

    private function basicAuth(): PendingRequest
    {
        return Http::withBasicAuth(
            (string) config('services.zoom.client_id'),
            (string) config('services.zoom.client_secret'),
        );
    }

    /** @return array<string, mixed> */
    private function bundleFrom(array $data): array
    {
        return [
            'access_token' => $data['access_token'] ?? null,
            'refresh_token' => $data['refresh_token'] ?? null,
            'expires_at' => now()->addSeconds(($data['expires_in'] ?? 3600) - 30)->toIso8601String(),
        ];
    }
}
