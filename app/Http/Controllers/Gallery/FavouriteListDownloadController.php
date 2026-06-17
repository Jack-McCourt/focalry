<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\FavouriteList;
use App\Support\PhotoArchive;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FavouriteListDownloadController extends Controller
{
    /**
     * Stream a ZIP of the original files in a visitor's favourite list.
     *
     * The Collection is resolved through the BelongsToStudio global scope, so a
     * studio can only download lists belonging to its own collections (404 otherwise).
     */
    public function download(Collection $collection, FavouriteList $list, PhotoArchive $archive): BinaryFileResponse
    {
        abort_unless($list->collection_id === $collection->id, 404);

        $items = $list->favourites()
            ->with('photo')
            ->get()
            ->pluck('photo')
            ->filter()
            ->map(fn ($photo) => [
                'key' => $photo->wasabi_key_original,
                'filename' => $photo->filename,
            ])
            ->filter(fn ($item) => ! empty($item['key']))
            ->values()
            ->all();

        abort_if(empty($items), 404, 'This list has no downloadable photos.');

        $name = Str::slug($collection->title.' '.$list->name).'.zip';

        return $archive->zip($items, $name);
    }

    /**
     * Export a favourite list as a CSV of filenames + notes (for Lightroom/Capture One).
     */
    public function exportCsv(Collection $collection, FavouriteList $list): StreamedResponse
    {
        abort_unless($list->collection_id === $collection->id, 404);

        $rows = $list->favourites()->with('photo:id,filename')->get();
        $filename = Str::slug($collection->title.' '.$list->name).'-favourites.csv';

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            // PHP 8.4: $escape must be passed explicitly; '' = RFC-4180 behaviour.
            fputcsv($out, ['Filename', 'Note'], ',', '"', '');
            foreach ($rows as $favourite) {
                if (! $favourite->photo) {
                    continue;
                }
                fputcsv($out, [$favourite->photo->filename, $favourite->note ?? ''], ',', '"', '');
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }
}
