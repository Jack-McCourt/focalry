<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\Photo;
use App\Support\PhotoArchive;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class GalleryDownloadController extends Controller
{
    /**
     * Verify the download PIN and remember it in the session.
     */
    public function verifyPin(Request $request, string $slug): JsonResponse
    {
        $collection = $this->resolveCollection($slug);
        $settings = $collection->download_settings ?? [];
        $pin = $settings['pin'] ?? null;

        if ($pin && hash_equals((string) $pin, (string) $request->input('pin'))) {
            session()->put("gallery_download_pin_{$collection->id}", true);

            return response()->json(['ok' => true]);
        }

        return response()->json(['ok' => false, 'error' => 'Incorrect PIN.'], 422);
    }

    /**
     * Download the whole gallery as a ZIP.
     */
    public function all(Request $request, string $slug, PhotoArchive $archive): BinaryFileResponse
    {
        $collection = $this->resolveCollection($slug);
        $this->ensureDownloadable($collection);

        $original = (bool) ($collection->download_settings['allow_original'] ?? false);

        $items = $collection->photos()
            ->where('status', 'ready')
            ->orderBy('position')
            ->get()
            ->map(fn (Photo $photo) => [
                'key' => $this->resolveKey($photo, $original),
                'filename' => $photo->filename,
            ])
            ->filter(fn ($item) => ! empty($item['key']))
            ->values()
            ->all();

        abort_if(empty($items), 404, 'No downloadable photos.');

        return $archive->zip($items, Str::slug($collection->title).'.zip');
    }

    /**
     * Download a single photo.
     */
    public function single(Request $request, string $slug, int $photoId, PhotoArchive $archive): BinaryFileResponse
    {
        $collection = $this->resolveCollection($slug);
        $this->ensureDownloadable($collection);

        $photo = $collection->photos()
            ->where('id', $photoId)
            ->where('status', 'ready')
            ->firstOrFail();

        $original = (bool) ($collection->download_settings['allow_original'] ?? false);

        return $archive->file($this->resolveKey($photo, $original), $photo->filename);
    }

    private function resolveCollection(string $slug): Collection
    {
        $collection = Collection::withoutGlobalScopes()
            ->where('slug', $slug)
            ->firstOrFail();

        abort_unless($collection->isPublished(), 404);

        return $collection;
    }

    private function resolveKey(Photo $photo, bool $original): ?string
    {
        if ($original) {
            return $photo->wasabi_key_original;
        }

        return $photo->derivativeKey('web') ?? $photo->wasabi_key_original;
    }

    /**
     * Enforce download settings: enabled, optional PIN, and password gate.
     */
    private function ensureDownloadable(Collection $collection): void
    {
        $settings = $collection->download_settings ?? [];

        abort_unless($settings['enabled'] ?? false, 403, 'Downloads are not enabled for this gallery.');

        // Respect the gallery's own password gate for direct download URLs.
        if ($collection->isPasswordProtected() && ! session()->has("gallery_auth_{$collection->id}")) {
            abort(403, 'Enter the gallery password first.');
        }

        if (($settings['require_pin'] ?? false) && ! empty($settings['pin'])) {
            abort_unless(
                session("gallery_download_pin_{$collection->id}"),
                403,
                'A PIN is required to download from this gallery.',
            );
        }
    }
}
