<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Http\Controllers\StudioManager\Concerns\ResolvesSite;
use App\Jobs\ImportSiteImage;
use App\Models\Collection;
use App\Models\GalleryRecentPick;
use App\Models\Photo;
use App\Support\Images;
use App\Support\LinkedGalleries;
use App\Support\PublicAsset;
use App\Support\StudioPaths;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Image handling for the website builder: direct uploads (converted to
 * size-capped WebP) and importing photos from the studio's client galleries.
 */
class SiteMediaController extends Controller
{
    use ResolvesSite;

    /**
     * Upload the website's own header logo — separate from the studio-wide logo
     * (which stays on invoices, emails and PDFs). Kept in its original format so
     * SVGs and transparency survive.
     */
    public function uploadLogo(Request $request): RedirectResponse
    {
        $request->validate([
            'logo' => 'required|image|mimes:png,jpg,jpeg,webp,svg|max:2048',
        ]);

        $site = $this->resolveSite();

        try {
            if ($site->logo_path) {
                Storage::disk('wasabi')->delete($site->logo_path);
            }
            $path = $request->file('logo')->storePublicly(StudioPaths::asset($site->studio_id, 'site/logo'), 'wasabi');
            $site->update(['logo_path' => $path]);
        } catch (\Throwable $e) {
            report($e);

            return back()->with('error', 'Could not save the logo. Please try again.');
        }

        return back()->with('success', 'Website logo updated.');
    }

    /** Remove the website's own logo (the header falls back to the studio logo). */
    public function deleteLogo(): RedirectResponse
    {
        $site = $this->resolveSite();

        if ($site->logo_path) {
            Storage::disk('wasabi')->delete($site->logo_path);
            $site->update(['logo_path' => null]);
        }

        return back()->with('success', 'Website logo removed.');
    }

    /** Upload the website's footer logo — a separate image from the header logo. */
    public function uploadFooterLogo(Request $request): RedirectResponse
    {
        $request->validate([
            'logo' => 'required|image|mimes:png,jpg,jpeg,webp,svg|max:2048',
        ]);

        $site = $this->resolveSite();

        try {
            if ($site->footer_logo_path) {
                Storage::disk('wasabi')->delete($site->footer_logo_path);
            }
            $path = $request->file('logo')->storePublicly(StudioPaths::asset($site->studio_id, 'site/logo'), 'wasabi');
            $site->update(['footer_logo_path' => $path]);
        } catch (\Throwable $e) {
            report($e);

            return back()->with('error', 'Could not save the logo. Please try again.');
        }

        return back()->with('success', 'Footer logo updated.');
    }

    /** Remove the website's footer logo. */
    public function deleteFooterLogo(): RedirectResponse
    {
        $site = $this->resolveSite();

        if ($site->footer_logo_path) {
            Storage::disk('wasabi')->delete($site->footer_logo_path);
            $site->update(['footer_logo_path' => null]);
        }

        return back()->with('success', 'Footer logo removed.');
    }

    /**
     * Async image upload for block image fields. Converts to size-capped WebP
     * for fast delivery (animated GIFs are kept as-is). Returns JSON {url, path}.
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'required|image|mimes:png,jpg,jpeg,webp,gif|max:8192',
        ]);

        $studioId = app('current.studio.id');
        $file = $request->file('image');
        $disk = Storage::disk('wasabi');

        // High-megapixel originals (big camera/phone files) can blow the default
        // time/memory limits while GD decodes + resizes them — a fatal error that
        // the try/catch below can't trap, so the user just sees "upload failed".
        // Give the resize room to breathe.
        @ini_set('memory_limit', '512M');
        @set_time_limit(120);

        // Everything lives in Wasabi (stateless — no local disk). Site images are
        // public assets on the live site, so they're stored public-read and served
        // via the bucket/CDN's permanent URL.
        // Filenames are unique (uuid) so the bytes never change — let browsers/CDN
        // cache them forever (fixes "Use efficient cache lifetimes").
        $opts = ['visibility' => 'public', 'CacheControl' => PublicAsset::CACHE_FOREVER];

        if ($file->getClientOriginalExtension() === 'gif') {
            // Keep animated GIFs untouched.
            $path = StudioPaths::asset($studioId, 'site/'.Str::uuid().'.gif');
            $disk->put($path, file_get_contents($file->getRealPath()), $opts);
        } else {
            $path = StudioPaths::asset($studioId, 'site/'.Str::uuid().'.webp');
            try {
                // Cap at 1920px wide (Full HD) — large enough for full-bleed hero
                // banners (a 16:9 source becomes 1920×1080) without shipping huge files.
                $disk->put($path, Images::webp($file->getRealPath(), 1920), $opts);
            } catch (\Throwable $e) {
                report($e);
                $path = StudioPaths::asset($studioId, 'site/'.Str::uuid().'.'.$file->getClientOriginalExtension());
                $disk->put($path, file_get_contents($file->getRealPath()), $opts);
            }
        }

        return response()->json([
            'url' => PublicAsset::url($path),
            'path' => $path,
        ]);
    }

    /**
     * Background-video upload (hero/slider). Stored as-is (no transcoding) on
     * public Wasabi — studios should upload web-ready, compressed MP4s.
     */
    public function uploadVideo(Request $request): JsonResponse
    {
        $request->validate([
            // ≤60MB — enough for a 20–30s 1080p background loop.
            'video' => 'required|file|mimes:mp4,webm|mimetypes:video/mp4,video/webm|max:61440',
        ]);

        $studioId = app('current.studio.id');
        $file = $request->file('video');
        $ext = strtolower($file->getClientOriginalExtension() ?: 'mp4');
        $path = StudioPaths::asset($studioId, 'site/video/'.Str::uuid().'.'.$ext);

        Storage::disk('wasabi')->put(
            $path,
            fopen($file->getRealPath(), 'r'),
            ['visibility' => 'public', 'CacheControl' => PublicAsset::CACHE_FOREVER],
        );

        return response()->json(['url' => PublicAsset::url($path)]);
    }

    /** Custom font upload (woff2/woff) for the site's typography. */
    public function uploadFont(Request $request): JsonResponse
    {
        $request->validate([
            'font' => 'required|file|max:2048',
        ]);

        $file = $request->file('font');
        $ext = strtolower($file->getClientOriginalExtension());
        if (! in_array($ext, ['woff2', 'woff'], true)) {
            return response()->json(['message' => 'Upload a .woff2 (or .woff) font file.'], 422);
        }

        $path = StudioPaths::asset(app('current.studio.id'), 'site/fonts/'.Str::uuid().'.'.$ext);
        Storage::disk('wasabi')->put($path, file_get_contents($file->getRealPath()), ['visibility' => 'public', 'CacheControl' => PublicAsset::CACHE_FOREVER]);

        // Suggest a display name from the filename.
        $name = str($file->getClientOriginalName())->beforeLast('.')->replace(['-', '_'], ' ')->title()->limit(40, '')->value();

        return response()->json(['url' => PublicAsset::url($path), 'name' => $name]);
    }

    /** Collections + their ready photos (signed thumbnails) for the gallery picker. */
    public function galleryImages(): JsonResponse
    {
        $collections = Collection::with(['photos' => fn ($q) => $q->where('status', 'ready')->orderBy('position')])
            ->orderByDesc('event_date')
            ->orderBy('title')
            ->get(['id', 'title', 'event_date']);

        return response()->json([
            'recent' => $this->recentlyUsedPhotos(),
            'collections' => $collections->map(fn (Collection $c) => [
                'id' => $c->id,
                'title' => $c->title,
                'photos' => $c->photos
                    ->map(fn (Photo $p) => $this->pickerPhoto($p))
                    ->filter(fn ($p) => $p['thumb'])
                    ->values(),
            ])->filter(fn ($c) => count($c['photos']) > 0)->values(),
        ]);
    }

    /**
     * Import chosen gallery photos into the site. Gallery URLs are signed/short-
     * lived, so a permanent public copy is made — but resizing a full-size
     * original is slow, so the conversion is queued (ImportSiteImage) and the
     * permanent URLs are returned instantly; the images fill in when the worker
     * finishes, just like main gallery uploads. Returns JSON {urls}.
     */
    public function importGalleryImages(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'photo_ids' => 'required|array|max:60',
            'photo_ids.*' => 'integer',
        ]);

        $studioId = app('current.studio.id');
        $urls = [];

        foreach ($validated['photo_ids'] as $id) {
            // Studio-scoped via the global scope, so cross-tenant ids are ignored.
            $photo = Photo::find($id);
            // Prefer the original so site/hero images can be Full HD (1920px); the
            // 1200px web derivative is only a fallback when there's no original.
            $key = $photo?->wasabi_key_original
                ?: ($photo?->derivativeKey('web') ?? $photo?->derivativeKey('preview') ?? $photo?->derivativeKey('thumb'));
            if (! $key) {
                continue;
            }

            // Queue the (slow) original→1920 WebP conversion to Wasabi; the public
            // URL is live the moment the worker writes the object.
            $dest = StudioPaths::asset($studioId, "site/gallery/{$photo->id}-".Str::random(6).'.webp');
            ImportSiteImage::dispatch($key, $dest, 1920);
            $urls[] = PublicAsset::url($dest);

            // Track for the picker's "Recently used" tab.
            GalleryRecentPick::touchPhoto($photo->id);
        }

        return response()->json(['urls' => $urls]);
    }

    /**
     * Link/refresh a gallery block against a client-gallery Collection: returns
     * the mirrored public URLs (queueing conversion of any new photos).
     */
    public function syncLinkedGallery(Request $request): JsonResponse
    {
        $validated = $request->validate(['collection_id' => 'required|integer']);

        // Studio-scoped via the global scope — cross-tenant ids 404.
        $collection = Collection::findOrFail($validated['collection_id']);

        $urls = LinkedGalleries::imageUrls((int) app('current.studio.id'), (int) $collection->id);

        return response()->json([
            'images' => $urls,
            'title' => $collection->title,
            'count' => count($urls),
        ]);
    }

    /** The studio's most-recently-used gallery photos, newest first. */
    private function recentlyUsedPhotos(int $limit = 40): array
    {
        $ids = GalleryRecentPick::orderByDesc('used_at')->limit($limit)->pluck('photo_id');
        if ($ids->isEmpty()) {
            return [];
        }

        $photos = Photo::whereIn('id', $ids)->where('status', 'ready')->get()->keyBy('id');

        // Preserve the recency order (whereIn doesn't), and drop any since deleted.
        return $ids
            ->map(fn ($id) => $photos->get($id))
            ->filter()
            ->map(fn (Photo $p) => $this->pickerPhoto($p))
            ->filter(fn ($p) => $p['thumb'])
            ->values()
            ->all();
    }

    /** @return array{id: int, thumb: string|null} */
    private function pickerPhoto(Photo $p): array
    {
        return ['id' => $p->id, 'thumb' => $p->firstSignedUrl(['thumb', 'web'], 180)];
    }
}
