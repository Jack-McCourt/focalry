<?php

namespace App\Jobs;

use App\Models\Photo;
use App\Models\Studio;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;

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

        $manager = new ImageManager(new Driver);

        $base = $manager->read($imageData);
        $width = $base->width();
        $height = $base->height();

        $exifTakenAt = $this->readExifDate($imageData);

        $s = $photo->studio_id;
        $c = $photo->collection_id;
        $p = $photo->id;

        $derivatives = [];

        $derivatives['thumb'] = "studios/{$s}/collections/{$c}/photos/{$p}/thumb.jpg";
        Storage::disk('wasabi')->put(
            $derivatives['thumb'],
            $manager->read($imageData)->scaleDown(300)->toJpeg(85)->toString()
        );

        $derivatives['web'] = "studios/{$s}/collections/{$c}/photos/{$p}/web.jpg";
        Storage::disk('wasabi')->put(
            $derivatives['web'],
            $manager->read($imageData)->scaleDown(1200)->toJpeg(88)->toString()
        );

        $derivatives['preview'] = "studios/{$s}/collections/{$c}/photos/{$p}/preview.jpg";
        $preview = $manager->read($imageData)->scaleDown(1200);
        $this->applyWatermark($manager, $preview, $photo->studio_id);
        Storage::disk('wasabi')->put(
            $derivatives['preview'],
            $preview->toJpeg(85)->toString()
        );

        $photo->update([
            'derivative_keys' => $derivatives,
            'width' => $width,
            'height' => $height,
            'exif_taken_at' => $exifTakenAt,
            'status' => 'ready',
        ]);
    }

    public function failed(\Throwable $e): void
    {
        $this->photo->fresh()?->update(['status' => 'failed']);
        Log::error('ProcessPhoto failed', ['photo_id' => $this->photo->id, 'error' => $e->getMessage()]);
    }

    private function applyWatermark(ImageManager $manager, $image, int $studioId): void
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

            $watermark = $manager->read($wmData)->scaleDown((int) ($image->width() * 0.3));
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
