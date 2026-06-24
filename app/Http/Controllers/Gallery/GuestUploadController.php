<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessPhoto;
use App\Models\Collection;
use App\Models\Photo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Public, PIN-gated photo uploads by event guests. Guests reach this by scanning
 * the QR card the studio prints from the admin side. There is no authentication —
 * the guards are: the feature must be enabled on the collection, a session PIN,
 * route throttling, images-only + a conservative size cap, and the studio's plan
 * storage quota (enforced at presign).
 */
class GuestUploadController extends Controller
{
    private const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    /** Guests upload phone photos — keep the cap well below the studio's 500 MB. */
    private const MAX_FILE_SIZE_MB = 25;

    public function show(Request $request, string $slug): Response
    {
        $collection = $this->resolveCollection($slug);
        $settings = $collection->guest_upload_settings ?? [];

        // The shared wall: every guest's processed upload. Pending ones (when
        // approval is on) are held back until the studio approves them.
        $photos = $collection->photos()
            ->where('is_guest_upload', true)
            ->where('status', 'ready')
            ->where('approved', true)
            ->orderByDesc('id')
            ->limit(200)
            ->get(['id', 'filename', 'uploader_name', 'caption', 'derivative_keys'])
            ->map(fn (Photo $p) => [
                'id' => $p->id,
                'uploader_name' => $p->uploader_name,
                'caption' => $p->caption,
                'thumb_url' => $p->firstSignedUrl(['grid', 'thumb', 'web', 'preview'], 120),
            ]);

        return Inertia::render('Gallery/GuestUpload', [
            'collection' => [
                'title' => $collection->title,
                'slug' => $collection->slug,
                'theme' => $collection->theme ?? 'dark',
            ],
            'title' => $settings['title'] ?? 'Share your photos',
            'message' => $settings['message'] ?? 'Add the photos you took today to the gallery.',
            'pin_required' => $collection->guestUploadPin() !== null,
            'pin_verified' => $this->pinVerified($request, $collection),
            'max_file_mb' => self::MAX_FILE_SIZE_MB,
            'photos' => $photos,
        ]);
    }

    public function verifyPin(Request $request, string $slug): JsonResponse
    {
        $collection = $this->resolveCollection($slug);
        $pin = $collection->guestUploadPin();

        if ($pin !== null && hash_equals($pin, (string) $request->input('pin'))) {
            session()->put($this->pinSessionKey($collection), true);

            return response()->json(['ok' => true]);
        }

        return response()->json(['ok' => false, 'error' => 'Incorrect PIN.'], 422);
    }

    public function presign(Request $request, string $slug): JsonResponse
    {
        $collection = $this->resolveCollection($slug);
        $this->ensurePinVerified($request, $collection);

        $validated = $request->validate([
            'filename' => 'required|string|max:255',
            'content_type' => 'required|string|in:'.implode(',', self::ALLOWED_MIME_TYPES),
            'file_size' => 'required|integer|max:'.(self::MAX_FILE_SIZE_MB * 1024 * 1024),
        ]);

        if (! $collection->studio->hasStorageFor($validated['file_size'])) {
            return response()->json([
                'message' => 'This gallery has no room for more uploads right now.',
            ], 422);
        }

        $extension = strtolower(pathinfo($validated['filename'], PATHINFO_EXTENSION));
        $objectKey = sprintf(
            'studios/%d/collections/%d/originals/%s.%s',
            $collection->studio_id,
            $collection->id,
            Str::uuid(),
            $extension,
        );

        $result = Storage::disk('wasabi')->temporaryUploadUrl(
            $objectKey,
            now()->addMinutes(30),
            ['Content-Type' => $validated['content_type']],
        );

        return response()->json([
            'url' => $result['url'],
            'headers' => $result['headers'] ?? [],
            'key' => $objectKey,
        ]);
    }

    public function register(Request $request, string $slug): JsonResponse
    {
        $collection = $this->resolveCollection($slug);
        $this->ensurePinVerified($request, $collection);

        $validated = $request->validate([
            'filename' => 'required|string|max:255',
            'wasabi_key' => 'required|string|max:500',
            'file_size' => 'nullable|integer|max:'.(self::MAX_FILE_SIZE_MB * 1024 * 1024),
            'uploader_name' => 'nullable|string|max:80',
            'caption' => 'nullable|string|max:500',
        ]);

        // The key must be one we just handed out for this collection — never trust
        // a client-supplied path into another studio/collection's storage.
        $expectedPrefix = sprintf('studios/%d/collections/%d/originals/', $collection->studio_id, $collection->id);
        if (! str_starts_with($validated['wasabi_key'], $expectedPrefix)) {
            abort(422, 'Invalid upload.');
        }

        $setId = $this->guestSetId($collection);

        $position = Photo::where('collection_id', $collection->id)->max('position') + 1;

        $photo = Photo::create([
            'studio_id' => $collection->studio_id,
            'collection_id' => $collection->id,
            'set_id' => $setId,
            'filename' => $validated['filename'],
            'wasabi_key_original' => $validated['wasabi_key'],
            'file_size' => $validated['file_size'] ?? null,
            'status' => 'processing',
            'is_guest_upload' => true,
            'approved' => ! $collection->guestUploadsNeedApproval(),
            'uploader_name' => $validated['uploader_name'] ?? null,
            'caption' => $validated['caption'] ?? null,
            'position' => $position,
        ]);

        ProcessPhoto::dispatch($photo);

        return response()->json(['ok' => true], 201);
    }

    /**
     * Resolve a published collection that has guest uploads enabled, binding its
     * studio for the rest of the request (so BelongsToStudio-scoped writes resolve
     * to the gallery's studio). 404 otherwise.
     */
    private function resolveCollection(string $slug): Collection
    {
        $collection = Collection::withoutGlobalScopes()
            ->where('slug', $slug)
            ->firstOrFail();

        if (! $collection->isPublished() || ! $collection->guestUploadsEnabled()) {
            abort(404);
        }

        app()->instance('current.studio.id', $collection->studio_id);

        return $collection;
    }

    /** The dedicated set guest photos go into, creating it if missing. */
    private function guestSetId(Collection $collection): int
    {
        $settings = $collection->guest_upload_settings ?? [];
        $setId = $settings['set_id'] ?? null;

        if ($setId && $collection->sets()->whereKey($setId)->exists()) {
            return (int) $setId;
        }

        $position = ((int) $collection->sets()->max('position')) + 1;
        $set = $collection->sets()->create([
            'name' => 'Guest Photos',
            'position' => $position,
            'visible' => (bool) ($settings['show_as_tab'] ?? true),
        ]);

        $settings['set_id'] = $set->id;
        $collection->update(['guest_upload_settings' => $settings]);

        return $set->id;
    }

    private function pinSessionKey(Collection $collection): string
    {
        return "gallery_guest_upload_pin_{$collection->id}";
    }

    private function pinVerified(Request $request, Collection $collection): bool
    {
        return $collection->guestUploadPin() === null
            || (bool) session($this->pinSessionKey($collection));
    }

    private function ensurePinVerified(Request $request, Collection $collection): void
    {
        if (! $this->pinVerified($request, $collection)) {
            abort(403, 'Enter the PIN to upload.');
        }
    }
}
