<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\Photo;
use App\Support\PhotoArchive;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The photographer's own favourites: photos they've starred across all of their
 * galleries, gathered in one place to review and download (per gallery or all
 * at once). Distinct from end-client favourites, which live per-collection.
 */
class FavouritesController extends Controller
{
    public function index(): Response
    {
        $groups = Photo::where('starred', true)
            ->where('status', 'ready')
            ->with('collection:id,title,slug')
            ->orderByDesc('id')
            ->get()
            ->filter(fn (Photo $p) => $p->collection !== null)
            ->groupBy('collection_id')
            ->map(fn ($photos) => [
                'collection' => [
                    'id' => $photos->first()->collection->id,
                    'title' => $photos->first()->collection->title,
                ],
                'count' => $photos->count(),
                'photos' => $photos->map(fn (Photo $p) => [
                    'id' => $p->id,
                    'collection_id' => $p->collection_id,
                    'thumb_url' => $p->firstSignedUrl(['grid', 'thumb', 'web', 'preview'], 120),
                ])->values(),
            ])
            ->sortByDesc('count')
            ->values();

        return Inertia::render('Favourites/Index', [
            'groups' => $groups,
            'total' => $groups->sum('count'),
        ]);
    }

    /** ZIP the starred originals of a single gallery. */
    public function download(Collection $collection, PhotoArchive $archive): StreamedResponse
    {
        $items = $collection->photos()
            ->where('starred', true)
            ->get(['id', 'filename', 'wasabi_key_original'])
            ->map(fn (Photo $p) => ['key' => $p->wasabi_key_original, 'filename' => $p->filename])
            ->filter(fn ($i) => ! empty($i['key']))
            ->values()
            ->all();

        abort_if(empty($items), 404, 'No favourites to download in this gallery.');

        return $archive->zip($items, Str::slug($collection->title.' favourites').'.zip');
    }

    /** ZIP every starred original across the studio, foldered by gallery. */
    public function downloadAll(PhotoArchive $archive): StreamedResponse
    {
        $items = Photo::where('starred', true)
            ->with('collection:id,title')
            ->get(['id', 'collection_id', 'filename', 'wasabi_key_original'])
            ->filter(fn (Photo $p) => ! empty($p->wasabi_key_original) && $p->collection)
            ->map(fn (Photo $p) => [
                'key' => $p->wasabi_key_original,
                // Group into a per-gallery folder inside the archive.
                'filename' => Str::slug($p->collection->title).'/'.$p->filename,
            ])
            ->values()
            ->all();

        abort_if(empty($items), 404, 'You have no favourites to download yet.');

        return $archive->zip($items, 'all-favourites.zip');
    }
}
