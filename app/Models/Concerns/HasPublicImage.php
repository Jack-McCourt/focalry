<?php

namespace App\Models\Concerns;

use App\Support\PublicAsset;
use App\Support\StudioPaths;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Shared behaviour for studio-scoped models with a public `image_path` column
 * (Product, Package, …): a single replace-the-image routine and the public URL
 * accessor, so each model/controller doesn't re-implement the upload dance.
 */
trait HasPublicImage
{
    /**
     * Replace the stored image with an uploaded file, deleting the previous one.
     * Stored under public/studios/{studio_id}/{folder}.
     */
    public function replaceImage(UploadedFile $file, string $folder): void
    {
        if ($this->image_path) {
            Storage::disk('wasabi')->delete($this->image_path);
        }

        $path = $file->storePublicly(StudioPaths::asset($this->studio_id, $folder), 'wasabi');
        $this->update(['image_path' => $path]);
    }

    /** Public (CDN) URL for the stored image, or null when there isn't one. */
    public function imageUrl(): ?string
    {
        return PublicAsset::url($this->image_path);
    }
}
