<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\Favourite;
use App\Models\FavouriteList;
use App\Models\GalleryVisitor;
use App\Models\Photo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class FavouriteController extends Controller
{
    /**
     * Capture or update the visitor's name/email (lightweight identity).
     */
    public function updateVisitor(Request $request, string $slug): JsonResponse
    {
        $collection = $this->resolveCollection($slug);

        // Email identifies the visitor (so favourites can be retrieved later);
        // name is optional.
        $validated = $request->validate([
            'email' => 'required|email|max:255',
            'name' => 'nullable|string|max:100',
        ]);

        $visitor = $this->resolveVisitor($collection);

        if (! $visitor) {
            // No active session: retrieve an existing identity by email so the
            // visitor gets their previous favourites back (any device), else start
            // a fresh one.
            $visitor = GalleryVisitor::where('collection_id', $collection->id)
                ->where('email', $validated['email'])
                ->latest('id')
                ->first()
                ?? GalleryVisitor::create([
                    'collection_id' => $collection->id,
                    'token' => Str::random(40),
                ]);
            session()->put("gallery_visitor_{$collection->id}", $visitor->token);
        }

        $visitor->update([
            'email' => $validated['email'],
            'name' => $validated['name'] ?? $visitor->name,
            'last_seen_at' => now(),
        ]);

        return response()->json([
            'visitor' => ['name' => $visitor->name, 'email' => $visitor->email],
            'lists' => $this->serializeLists($visitor, $collection),
        ]);
    }

    /**
     * Return all of the visitor's favourite lists for this collection.
     */
    public function lists(Request $request, string $slug): JsonResponse
    {
        $collection = $this->resolveCollection($slug);
        $visitor = $this->resolveVisitor($collection);

        if (! $visitor) {
            return response()->json(['lists' => [], 'visitor' => null]);
        }

        return response()->json([
            'lists' => $this->serializeLists($visitor, $collection),
            'visitor' => ['name' => $visitor->name, 'email' => $visitor->email],
        ]);
    }

    /**
     * Create a new named favourite list for the visitor.
     */
    public function createList(Request $request, string $slug): JsonResponse
    {
        $collection = $this->resolveCollection($slug);
        $visitor = $this->resolveVisitor($collection);

        if (! $visitor) {
            return response()->json(['error' => 'Not authenticated'], 401);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:100',
        ]);

        $list = FavouriteList::create([
            'collection_id' => $collection->id,
            'visitor_id' => $visitor->id,
            'name' => $validated['name'],
        ]);

        return response()->json([
            'list' => ['id' => $list->id, 'name' => $list->name, 'photo_ids' => [], 'notes' => []],
        ]);
    }

    /**
     * Toggle a photo in a specific list (or the visitor's default list).
     */
    public function toggle(Request $request, string $slug, int $photoId): JsonResponse
    {
        $collection = $this->resolveCollection($slug);
        $visitor = $this->resolveVisitor($collection);

        if (! $visitor) {
            return response()->json(['error' => 'Not authenticated'], 401);
        }

        $validated = $request->validate([
            'list_id' => 'nullable|integer',
        ]);

        $photo = Photo::where('id', $photoId)
            ->where('collection_id', $collection->id)
            ->where('status', 'ready')
            ->firstOrFail();

        if (! empty($validated['list_id'])) {
            $list = FavouriteList::where('id', $validated['list_id'])
                ->where('collection_id', $collection->id)
                ->where('visitor_id', $visitor->id)
                ->firstOrFail();
        } else {
            $list = FavouriteList::firstOrCreate(
                ['collection_id' => $collection->id, 'visitor_id' => $visitor->id],
                ['name' => 'My Favourites'],
            );
        }

        $existing = Favourite::where('list_id', $list->id)
            ->where('photo_id', $photo->id)
            ->first();

        if ($existing) {
            $existing->delete();

            return response()->json([
                'favourited' => false,
                'list' => ['id' => $list->id, 'name' => $list->name],
                'count' => $list->favourites()->count(),
            ]);
        }

        if ($list->hasReachedLimit()) {
            return response()->json(['error' => 'Selection limit reached'], 422);
        }

        Favourite::create([
            'list_id' => $list->id,
            'photo_id' => $photo->id,
        ]);

        return response()->json([
            'favourited' => true,
            'list' => ['id' => $list->id, 'name' => $list->name],
            'count' => $list->favourites()->count(),
        ]);
    }

    /**
     * Add or update the note on a favourited photo (per list).
     */
    public function note(Request $request, string $slug, int $photoId): JsonResponse
    {
        $collection = $this->resolveCollection($slug);
        $visitor = $this->resolveVisitor($collection);

        if (! $visitor) {
            return response()->json(['error' => 'Not authenticated'], 401);
        }

        $validated = $request->validate([
            'list_id' => 'required|integer',
            'note' => 'nullable|string|max:2000',
        ]);

        $list = FavouriteList::where('id', $validated['list_id'])
            ->where('collection_id', $collection->id)
            ->where('visitor_id', $visitor->id)
            ->firstOrFail();

        $favourite = Favourite::where('list_id', $list->id)
            ->where('photo_id', $photoId)
            ->firstOrFail();

        $favourite->update(['note' => $validated['note'] ?: null]);

        return response()->json(['note' => $favourite->note]);
    }

    private function resolveCollection(string $slug): Collection
    {
        return Collection::withoutGlobalScopes()
            ->where('slug', $slug)
            ->firstOrFail();
    }

    private function resolveVisitor(Collection $collection): ?GalleryVisitor
    {
        $token = session("gallery_visitor_{$collection->id}");

        if (! $token) {
            return null;
        }

        return GalleryVisitor::where('collection_id', $collection->id)
            ->where('token', $token)
            ->first();
    }

    private function serializeLists(GalleryVisitor $visitor, Collection $collection): array
    {
        return $visitor->favouriteLists()
            ->where('collection_id', $collection->id)
            ->with('favourites:id,list_id,photo_id,note')
            ->get()
            ->map(fn (FavouriteList $list) => self::serializeList($list))
            ->toArray();
    }

    /**
     * @return array{id: int, name: string, photo_ids: array<int, int>, notes: array<int, string>}
     */
    public static function serializeList(FavouriteList $list): array
    {
        $favourites = $list->relationLoaded('favourites')
            ? $list->favourites
            : $list->favourites()->get(['id', 'list_id', 'photo_id', 'note']);

        return [
            'id' => $list->id,
            'name' => $list->name,
            'photo_ids' => $favourites->pluck('photo_id')->map(fn ($id) => (int) $id)->toArray(),
            'notes' => $favourites->whereNotNull('note')->pluck('note', 'photo_id')->toArray(),
        ];
    }
}
