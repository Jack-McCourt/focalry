<?php

namespace App\Jobs;

use App\Models\Photo;
use App\Models\Studio;
use App\Support\Images;
use App\Support\StudioPaths;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Interfaces\ImageInterface;

class ProcessPhoto implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 300;

    public function __construct(public readonly Photo $photo) {}

    public function handle(): void
    {
        $photo = $this->photo->fresh();

        if (! $photo || $photo->status === 'ready') {
            return;
        }

        $originalStream = Storage::disk('wasabi')->readStream($photo->wasabi_key_original);
        $imageData = stream_get_contents($originalStream);
        fclose($originalStream);

        $dimensions = Images::manager()->read($imageData);
        $width = $dimensions->width();
        $height = $dimensions->height();

        $exifTakenAt = $this->readExifDate($imageData);

        // Display derivatives live under the public prefix with a high-entropy,
        // unguessable path segment: they're served as stable (cacheable) public
        // CDN URLs rather than signed ones, so the random token is what keeps
        // them from being enumerated. Originals stay private (outside public/).
        $dir = StudioPaths::asset($photo->studio_id, "collections/{$photo->collection_id}/photos/{$photo->id}/".Str::random(40));
        $disk = Storage::disk('wasabi');

        $derivatives = [];

        $derivatives['thumb'] = "{$dir}/thumb.jpg";
        $disk->put($derivatives['thumb'], Images::jpeg($imageData, 300, 85), 'public');

        // Mid-size for retina gallery grids: ~2× the thumb so high-DPI screens
        // stay crisp without pulling the full 1200px web image per tile.
        $derivatives['grid'] = "{$dir}/grid.jpg";
        $disk->put($derivatives['grid'], Images::jpeg($imageData, 600, 82), 'public');

        $derivatives['web'] = "{$dir}/web.jpg";
        $disk->put($derivatives['web'], Images::jpeg($imageData, 1200, 88), 'public');

        // Preview is watermarked between resize and encode, so it can't use the
        // one-shot Images::jpeg helper. Guest uploads stay clean — the studio's
        // watermark only belongs on the photographer's own work.
        $derivatives['preview'] = "{$dir}/preview.jpg";
        $preview = Images::read($imageData, 1200);
        if (! $photo->is_guest_upload) {
            $this->applyWatermark($preview, $photo->studio_id);
        }
        $disk->put($derivatives['preview'], $preview->toJpeg(85)->toString(), 'public');

        $photo->update([
            'derivative_keys' => $derivatives,
            'width' => $width,
            'height' => $height,
            'exif_taken_at' => $exifTakenAt,
            // Default ordering = capture time (falls back to upload time), stored
            // as a unix timestamp in `position` so galleries are chronological by
            // default; manual drag-reorder / the sort button just rewrite these.
            'position' => ($exifTakenAt ?? $photo->created_at ?? now())->timestamp,
            'status' => 'ready',
        ]);
    }

    public function failed(\Throwable $e): void
    {
        $this->photo->fresh()?->update(['status' => 'failed']);
        Log::error('ProcessPhoto failed', ['photo_id' => $this->photo->id, 'error' => $e->getMessage()]);
    }

    private function applyWatermark(ImageInterface $image, int $studioId): void
    {
        try {
            $studio = Studio::find($studioId);
            if (! $studio?->watermark_path) {
                return;
            }

            $wmData = Storage::disk('wasabi')->get($studio->watermark_path);
            if (! $wmData) {
                return;
            }

            $watermark = Images::manager()->read($wmData)->scaleDown((int) ($image->width() * 0.3));
            $image->place($watermark, 'center', 0, 0, 60);
        } catch (\Throwable) {
            // Watermark is optional — don't fail the job
        }
    }

    private function readExifDate(string $imageData): ?\DateTimeInterface
    {
        try {
            $exif = @exif_read_data('data://image/jpeg;base64,'.base64_encode($imageData));
            if (is_array($exif) && isset($exif['DateTimeOriginal'])) {
                return Carbon::createFromFormat('Y:m:d H:i:s', $exif['DateTimeOriginal']);
            }
        } catch (\Throwable) {
        }

        return null;
    }
}
