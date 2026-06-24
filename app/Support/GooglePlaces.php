<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Thin wrapper over the Google Places API (New) used by the website builder's
 * Google Reviews block. Two operations:
 *
 *   - searchText(): find a business by name/address so the user can pick the
 *     right listing without hunting down a Place ID by hand.
 *   - placeDetails(): pull the business summary + its (up to 5) reviews.
 *
 * Responses are normalised to flat arrays the front-end stores verbatim in the
 * block, so the published site renders reviews without any further API calls
 * (and the API key never reaches the browser).
 */
class GooglePlaces
{
    private const BASE = 'https://places.googleapis.com/v1';

    public static function configured(): bool
    {
        return (bool) config('services.google.places_key');
    }

    private function key(): string
    {
        $key = config('services.google.places_key');

        if (! $key) {
            throw new RuntimeException('Google Places API key not configured. Add GOOGLE_PLACES_API_KEY to your .env.');
        }

        return $key;
    }

    /**
     * Search for matching businesses.
     *
     * @return list<array{place_id: string, name: string, address: string}>
     */
    public function searchText(string $query): array
    {
        $response = Http::withHeaders([
            'X-Goog-Api-Key' => $this->key(),
            'X-Goog-FieldMask' => 'places.id,places.displayName,places.formattedAddress',
        ])->post(self::BASE.'/places:searchText', [
            'textQuery' => $query,
            'maxResultCount' => 8,
        ]);

        if ($response->failed()) {
            throw new RuntimeException($this->errorMessage($response->json()));
        }

        return collect($response->json('places', []))
            ->map(fn (array $p) => [
                'place_id' => $p['id'] ?? '',
                'name' => $p['displayName']['text'] ?? 'Unknown',
                'address' => $p['formattedAddress'] ?? '',
            ])
            ->filter(fn ($p) => $p['place_id'] !== '')
            ->values()
            ->all();
    }

    /**
     * Fetch a place's summary + reviews.
     *
     * @return array{place_id: string, name: string, rating: float|null, total: int, url: string|null, reviews: list<array<string, mixed>>}
     */
    public function placeDetails(string $placeId): array
    {
        $response = Http::withHeaders([
            'X-Goog-Api-Key' => $this->key(),
            'X-Goog-FieldMask' => 'id,displayName,rating,userRatingCount,googleMapsUri,reviews',
        ])->get(self::BASE.'/places/'.rawurlencode($placeId));

        if ($response->failed()) {
            throw new RuntimeException($this->errorMessage($response->json()));
        }

        $data = $response->json();

        $reviews = collect($data['reviews'] ?? [])
            ->map(fn (array $r) => [
                'author' => $r['authorAttribution']['displayName'] ?? 'Anonymous',
                'avatar' => $r['authorAttribution']['photoUri'] ?? null,
                'profile_url' => $r['authorAttribution']['uri'] ?? null,
                'rating' => (int) ($r['rating'] ?? 0),
                'text' => $r['text']['text'] ?? ($r['originalText']['text'] ?? ''),
                'relative_time' => $r['relativePublishTimeDescription'] ?? '',
                'time' => $r['publishTime'] ?? null,
            ])
            ->values()
            ->all();

        return [
            'place_id' => $data['id'] ?? $placeId,
            'name' => $data['displayName']['text'] ?? 'Business',
            'rating' => isset($data['rating']) ? (float) $data['rating'] : null,
            'total' => (int) ($data['userRatingCount'] ?? 0),
            'url' => $data['googleMapsUri'] ?? null,
            'reviews' => $reviews,
        ];
    }

    /** @param array<string, mixed>|null $body */
    private function errorMessage(?array $body): string
    {
        return $body['error']['message'] ?? 'Google Places request failed. Check the Place ID and that the Places API is enabled for your key.';
    }
}
