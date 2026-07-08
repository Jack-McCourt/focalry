<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Http\Controllers\StudioManager\Concerns\ResolvesSite;
use App\Support\InstagramApi;
use App\Support\PublicAsset;
use App\Support\StudioPaths;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * Instagram connection for the website's feed block: OAuth connect/disconnect
 * plus a fetch endpoint that snapshots the latest posts (images mirrored to our
 * bucket — Instagram's CDN URLs expire, and the public site never calls Meta).
 */
class SiteInstagramController extends Controller
{
    use ResolvesSite;

    /** Send the studio to Instagram's consent screen. */
    public function connect(): RedirectResponse
    {
        if (! InstagramApi::configured()) {
            return redirect()->route('website.edit')->with('error', 'Instagram is not set up on this platform yet.');
        }

        return redirect()->away(InstagramApi::authorizeUrl());
    }

    /** OAuth callback: store a long-lived token + username on the site. */
    public function callback(Request $request): RedirectResponse
    {
        if ($request->query('error') || ! $request->query('code')) {
            return redirect()->route('website.edit')->with('error', 'Instagram connection was cancelled.');
        }

        $site = $this->resolveSite();

        try {
            $token = InstagramApi::exchangeCode((string) $request->query('code'));
            $profile = InstagramApi::profile($token['token']);

            $site->update([
                'instagram_token' => $token['token'],
                'instagram_token_expires_at' => $token['expires_at'],
                'instagram_username' => $profile['username'] ?? null,
            ]);
        } catch (\Throwable $e) {
            report($e);

            return redirect()->route('website.edit')->with('error', 'Instagram connection failed — please try again.');
        }

        return redirect()->route('website.edit')->with('success', 'Instagram connected. Open your Instagram block and load your posts.');
    }

    public function disconnect(): RedirectResponse
    {
        $this->resolveSite()->update([
            'instagram_token' => null,
            'instagram_token_expires_at' => null,
            'instagram_username' => null,
        ]);

        return back()->with('success', 'Instagram disconnected.');
    }

    /**
     * Snapshot the latest posts for the block: pulls media, mirrors each image
     * to our public bucket (idempotent per media id), returns block-ready items.
     */
    public function fetch(Request $request): JsonResponse
    {
        $validated = $request->validate(['limit' => 'nullable|integer|min:1|max:24']);

        $site = $this->resolveSite();
        if (! $site->instagram_token) {
            return response()->json(['message' => 'Connect Instagram first.'], 422);
        }

        try {
            $media = InstagramApi::media($site->instagram_token, (int) ($validated['limit'] ?? 12));
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'Could not reach Instagram — try reconnecting.'], 422);
        }

        $disk = Storage::disk('wasabi');
        $studioId = (int) app('current.studio.id');
        $dir = StudioPaths::asset($studioId, 'site/instagram');
        $existing = collect($disk->files($dir))->map(fn ($f) => basename($f))->flip();

        $items = [];
        foreach ($media as $m) {
            $file = "{$m['id']}.jpg";
            $path = "{$dir}/{$file}";

            if (! isset($existing[$file])) {
                try {
                    $res = Http::timeout(10)->get($m['image']);
                    if ($res->failed()) {
                        continue;
                    }
                    $disk->put($path, $res->body(), ['visibility' => 'public', 'CacheControl' => PublicAsset::CACHE_FOREVER]);
                } catch (\Throwable $e) {
                    report($e);

                    continue;
                }
            }

            $items[] = [
                'id' => $m['id'],
                'image' => PublicAsset::url($path),
                'permalink' => $m['permalink'],
                'caption' => str($m['caption'])->limit(180)->value(),
            ];
        }

        return response()->json([
            'items' => $items,
            'username' => $site->instagram_username,
        ]);
    }
}
