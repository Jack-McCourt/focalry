<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

/**
 * Instagram API with Instagram Login (business/creator accounts): OAuth code →
 * short-lived token → long-lived token (~60 days, refreshed by the scheduled
 * instagram:refresh-tokens command), then media pulls for the feed block.
 *
 * Like Google Reviews, results are snapshotted into the block JSON and images
 * mirrored to our bucket — the public site never calls Instagram.
 */
class InstagramApi
{
    public static function configured(): bool
    {
        return (bool) (config('services.instagram.client_id') && config('services.instagram.client_secret'));
    }

    public static function redirectUri(): string
    {
        return route('website.instagram.callback');
    }

    /** The Instagram authorize URL the studio is sent to. */
    public static function authorizeUrl(): string
    {
        return 'https://www.instagram.com/oauth/authorize?'.http_build_query([
            'client_id' => config('services.instagram.client_id'),
            'redirect_uri' => self::redirectUri(),
            'scope' => 'instagram_business_basic',
            'response_type' => 'code',
        ]);
    }

    /**
     * Exchange the callback code for a LONG-lived token.
     *
     * @return array{token: string, expires_at: Carbon}
     */
    public static function exchangeCode(string $code): array
    {
        $short = Http::asForm()->post('https://api.instagram.com/oauth/access_token', [
            'client_id' => config('services.instagram.client_id'),
            'client_secret' => config('services.instagram.client_secret'),
            'grant_type' => 'authorization_code',
            'redirect_uri' => self::redirectUri(),
            'code' => $code,
        ])->throw()->json();

        $long = Http::get('https://graph.instagram.com/access_token', [
            'grant_type' => 'ig_exchange_token',
            'client_secret' => config('services.instagram.client_secret'),
            'access_token' => $short['access_token'],
        ])->throw()->json();

        return [
            'token' => $long['access_token'],
            'expires_at' => now()->addSeconds((int) ($long['expires_in'] ?? 5184000)),
        ];
    }

    /** Refresh a long-lived token (valid for another ~60 days). */
    public static function refresh(string $token): array
    {
        $res = Http::get('https://graph.instagram.com/refresh_access_token', [
            'grant_type' => 'ig_refresh_token',
            'access_token' => $token,
        ])->throw()->json();

        return [
            'token' => $res['access_token'],
            'expires_at' => now()->addSeconds((int) ($res['expires_in'] ?? 5184000)),
        ];
    }

    /** @return array{username: string} */
    public static function profile(string $token): array
    {
        return Http::get('https://graph.instagram.com/me', [
            'fields' => 'username',
            'access_token' => $token,
        ])->throw()->json();
    }

    /**
     * Latest media. Videos/reels use their thumbnail; children of carousels are
     * not expanded (the cover image represents the post).
     *
     * @return list<array{id: string, image: string, permalink: string, caption: string, type: string}>
     */
    public static function media(string $token, int $limit = 24): array
    {
        $res = Http::get('https://graph.instagram.com/me/media', [
            'fields' => 'id,caption,media_type,media_url,thumbnail_url,permalink',
            'limit' => min(50, max(1, $limit)),
            'access_token' => $token,
        ])->throw()->json();

        return collect($res['data'] ?? [])
            ->map(fn ($m) => [
                'id' => (string) $m['id'],
                'image' => (string) ($m['media_type'] === 'VIDEO' ? ($m['thumbnail_url'] ?? '') : ($m['media_url'] ?? '')),
                'permalink' => (string) ($m['permalink'] ?? ''),
                'caption' => (string) ($m['caption'] ?? ''),
                'type' => (string) ($m['media_type'] ?? 'IMAGE'),
            ])
            ->filter(fn ($m) => $m['image'] !== '')
            ->values()
            ->all();
    }
}
