<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PresignedUploadController extends Controller
{
    private const ALLOWED_MIME_TYPES = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/quicktime',
    ];

    private const MAX_FILE_SIZE_MB = 500;

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'collection_id' => 'required|integer',
            'filename' => 'required|string|max:255',
            'content_type' => 'required|string|in:'.implode(',', self::ALLOWED_MIME_TYPES),
            'file_size' => 'required|integer|max:'.(self::MAX_FILE_SIZE_MB * 1024 * 1024),
        ]);

        // BelongsToStudio global scope ensures 404 if not this studio's collection
        Collection::findOrFail($validated['collection_id']);

        // Enforce the studio's plan storage quota before handing out an upload URL.
        $studio = $request->user()->studio;
        if (! $studio->hasStorageFor($validated['file_size'])) {
            return response()->json([
                'message' => 'Storage limit reached for your plan. Upgrade to upload more.',
                'upgrade_url' => route('billing.index'),
            ], 422);
        }

        $studioId = $request->user()->studio_id;
        $collectionId = $validated['collection_id'];
        $extension = strtolower(pathinfo($validated['filename'], PATHINFO_EXTENSION));
        $objectKey = sprintf(
            'studios/%d/collections/%d/originals/%s.%s',
            $studioId,
            $collectionId,
            Str::uuid(),
            $extension,
        );

        // temporaryUploadUrl returns ['url' => string, 'headers' => array] in Laravel 11.
        // We only sign Content-Type (not Content-Length) to avoid browser header restrictions.
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
}
