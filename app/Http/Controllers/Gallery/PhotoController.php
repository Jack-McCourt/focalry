<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessPhoto;
use App\Models\Collection;
use App\Models\Photo;
use App\Models\Set;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PhotoController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'collection_id' => 'required|integer',
            'set_id' => 'nullable|integer|exists:sets,id',
            'filename' => 'required|string|max:255',
            'wasabi_key' => 'required|string|max:500',
            'file_size' => 'nullable|integer|max:524288000',
        ]);

        // BelongsToStudio global scope ensures this 404s if not the studio's collection
        $collection = Collection::findOrFail($validated['collection_id']);

        // Photos always belong to a set. Default to the active/first set, creating
        // a "Highlights" set if the collection somehow has none.
        $setId = $validated['set_id'] ?? $collection->sets()->orderBy('position')->value('id');
        if ($setId === null) {
            $setId = $collection->sets()->create([
                'name' => 'Highlights',
                'position' => 1,
                'visible' => true,
            ])->id;
        }

        $position = Photo::where('collection_id', $collection->id)->max('position') + 1;

        $photo = Photo::create([
            'collection_id' => $collection->id,
            'set_id' => $setId,
            'filename' => $validated['filename'],
            'wasabi_key_original' => $validated['wasabi_key'],
            'file_size' => $validated['file_size'] ?? null,
            'status' => 'processing',
            'position' => $position,
        ]);

        ProcessPhoto::dispatch($photo);

        return response()->json(['photo' => $photo], 201);
    }

    public function update(Request $request, Photo $photo): JsonResponse
    {
        $validated = $request->validate([
            'set_id' => 'nullable|integer',
        ]);

        if ($validated['set_id'] !== null) {
            $setExists = $photo->collection->sets()
                ->where('id', $validated['set_id'])
                ->exists();

            if (! $setExists) {
                return response()->json(['error' => 'Invalid set'], 422);
            }
        }

        $photo->update(['set_id' => $validated['set_id']]);

        return response()->json(['set_id' => $photo->set_id]);
    }

    /**
     * Bulk-assign photos to a set (or to "uncategorised" with set_id = null).
     */
    public function assignSet(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'photo_ids' => 'required|array|min:1',
            'photo_ids.*' => 'integer',
            'set_id' => 'nullable|integer',
        ]);

        // BelongsToStudio global scope ensures only the current studio's photos load.
        $photos = Photo::whereIn('id', $validated['photo_ids'])->get();

        if ($photos->isEmpty()) {
            return response()->json(['updated' => 0]);
        }

        // All selected photos must share one collection, and the target set must
        // belong to that same collection.
        $collectionIds = $photos->pluck('collection_id')->unique();
        if ($collectionIds->count() > 1) {
            return response()->json(['error' => 'Photos span multiple galleries'], 422);
        }

        if ($validated['set_id'] !== null) {
            $setExists = Set::where('id', $validated['set_id'])
                ->where('collection_id', $collectionIds->first())
                ->exists();

            if (! $setExists) {
                return response()->json(['error' => 'Invalid set'], 422);
            }
        }

        Photo::whereIn('id', $photos->pluck('id'))->update(['set_id' => $validated['set_id']]);

        return response()->json([
            'updated' => $photos->count(),
            'set_id' => $validated['set_id'],
            'photo_ids' => $photos->pluck('id'),
        ]);
    }

    public function setCover(Request $request, Photo $photo): JsonResponse
    {
        $photo->collection->update(['cover_photo_id' => $photo->id]);

        return response()->json(['cover_photo_id' => $photo->id]);
    }

    public function destroy(Photo $photo): JsonResponse
    {
        // Authorization via global scope — 404 if not this studio's photo
        $photo->delete();

        return response()->json(null, 204);
    }

    /**
     * Persist a new manual order for a group of photos (e.g. one set). The
     * group's existing position "slots" are reassigned in the new order, so
     * reordering within a set never disturbs photos in other sets.
     */
    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'collection_id' => 'required|integer',
            'photo_ids' => 'required|array',
            'photo_ids.*' => 'integer',
        ]);

        // 404s via the BelongsToStudio scope if it isn't this studio's collection.
        $collection = Collection::findOrFail($data['collection_id']);

        $slots = Photo::where('collection_id', $collection->id)
            ->whereIn('id', $data['photo_ids'])
            ->pluck('position')
            ->sort()
            ->values();

        DB::transaction(function () use ($data, $slots, $collection) {
            foreach (array_values($data['photo_ids']) as $i => $id) {
                if (isset($slots[$i])) {
                    Photo::where('collection_id', $collection->id)->where('id', $id)
                        ->update(['position' => $slots[$i]]);
                }
            }
        });

        return response()->json(['ok' => true]);
    }

    /**
     * Reset a collection's order to capture time (EXIF), falling back to upload
     * time for shots with no embedded date. Returns the new id order so the
     * client can update its grid in place.
     */
    public function sortByTime(Request $request): JsonResponse
    {
        $data = $request->validate(['collection_id' => 'required|integer']);
        $collection = Collection::findOrFail($data['collection_id']);

        DB::table('photos')
            ->where('collection_id', $collection->id)
            ->update(['position' => DB::raw('COALESCE(UNIX_TIMESTAMP(exif_taken_at), UNIX_TIMESTAMP(created_at))')]);

        $order = Photo::where('collection_id', $collection->id)->orderBy('position')->pluck('id');

        return response()->json(['order' => $order]);
    }
}
