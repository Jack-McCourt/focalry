<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Support\GooglePlaces;
use App\Support\PublicAsset;
use App\Support\StudioPaths;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * Google Reviews for the website builder's reviews block: search for the
 * studio's business listing, then fetch its summary + reviews. Results are
 * cached in the block's JSON so the public site never calls Google.
 */
class SiteReviewsController extends Controller
{
    /** Search Google for a business so the user can pick their listing. */
    public function search(Request $request, GooglePlaces $places): JsonResponse
    {
        $validated = $request->validate([
            'query' => 'required|string|max:255',
        ]);

        if (! GooglePlaces::configured()) {
            return response()->json(['message' => 'Google reviews are not set up on this platform yet.'], 422);
        }

        try {
            return response()->json(['results' => $places->searchText($validated['query'])]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /** Pull a place's summary + reviews from Google for the reviews block. */
    public function fetch(Request $request, GooglePlaces $places): JsonResponse
    {
        $validated = $request->validate([
            'place_id' => 'required|string|max:255',
        ]);

        if (! GooglePlaces::configured()) {
            return response()->json(['message' => 'Google reviews are not set up on this platform yet.'], 422);
        }

        try {
            $details = $places->placeDetails($validated['place_id']);
            $details['reviews'] = $this->mirrorReviewAvatars($details['reviews'] ?? []);

            return response()->json($details);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Copy reviewer avatars off Google (lh3.googleusercontent.com) into our own
     * Wasabi bucket and rewrite each `avatar` URL to the hosted copy. Serving them
     * first-party avoids the third-party cookies Google's image host sets (a
     * Lighthouse "best practices" flag). Failures fall back to the original URL.
     *
     * @param  list<array<string, mixed>>  $reviews
     * @return list<array<string, mixed>>
     */
    private function mirrorReviewAvatars(array $reviews): array
    {
        $studioId = app('current.studio.id');
        $disk = Storage::disk('wasabi');

        foreach ($reviews as &$review) {
            $url = $review['avatar'] ?? null;
            // Only mirror Google's own image host (checked by hostname, not substring).
            $avatarHost = $url ? strtolower((string) parse_url((string) $url, PHP_URL_HOST)) : '';
            if (! $url || ! str_ends_with($avatarHost, 'googleusercontent.com')) {
                continue; // nothing to mirror (already hosted or no photo)
            }

            try {
                $response = Http::timeout(8)->get($url);
                if ($response->failed()) {
                    continue;
                }

                $path = StudioPaths::asset($studioId, 'site/reviews/'.md5((string) $url).'.jpg');
                $disk->put($path, $response->body(), ['visibility' => 'public', 'CacheControl' => PublicAsset::CACHE_FOREVER]);
                $review['avatar'] = PublicAsset::url($path);
            } catch (\Throwable $e) {
                report($e); // keep the original Google URL on failure
            }
        }

        return $reviews;
    }
}
