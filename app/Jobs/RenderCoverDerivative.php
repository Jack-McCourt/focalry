<?php

namespace App\Jobs;

use App\Models\Photo;
use App\Support\Images;
use App\Support\StudioPaths;
use App\Support\WasabiObject;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Renders a high-resolution (1920px wide) public "cover" derivative for a photo
 * used as a gallery cover, from its original. The web/preview derivatives top out
 * at 1200px, which looks soft on a full-bleed desktop cover banner.
 */
class RenderCoverDerivative implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 5;

    public function __construct(public int $photoId) {}

    public function handle(): void
    {
        $photo = Photo::withoutGlobalScopes()->find($this->photoId);
        if (! $photo?->wasabi_key_original) {
            return;
        }

        $dir = StudioPaths::asset($photo->studio_id, "collections/{$photo->collection_id}/photos/{$photo->id}/".Str::random(40));
        $dest = "{$dir}/cover.webp";

        $local = WasabiObject::toTempFile($photo->wasabi_key_original);
        try {
            Storage::disk('wasabi')->put($dest, Images::webp($local, 1920), 'public');
        } finally {
            @unlink($local);
        }

        $keys = $photo->derivative_keys ?? [];
        $keys['cover'] = $dest;
        $photo->forceFill(['derivative_keys' => $keys])->save();
    }
}
