<?php

namespace App\Jobs;

use App\Support\Images;
use App\Support\WasabiObject;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

/**
 * Copies a gallery photo into the site's Wasabi storage as a size-capped,
 * public-read WebP (site images are stateless — nothing on local disk).
 *
 * Runs on the queue (not the request) because reading + resizing a full-size
 * original is slow — the website builder gets the destination URL back instantly
 * and the image fills in once this job writes the object, mirroring how main
 * gallery uploads are processed by ProcessPhoto.
 */
class ImportSiteImage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Retry a few times — a transient Wasabi read shouldn't drop the image. */
    public int $tries = 3;

    public int $backoff = 5;

    public function __construct(
        public string $sourceKey,
        public string $destPath,
        public int $maxWidth = 1920,
    ) {}

    public function handle(): void
    {
        // Stream the source to a temp file (one image on disk at a time; dodges
        // the php-fpm tempnam spill on large originals).
        $localPath = WasabiObject::toTempFile($this->sourceKey);

        try {
            // Public-read so the live site can serve it via the bucket/CDN URL.
            Storage::disk('wasabi')->put($this->destPath, Images::webp($localPath, $this->maxWidth), 'public');
        } finally {
            @unlink($localPath);
        }
    }
}
