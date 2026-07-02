<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

/**
 * Shared logic for the responsive-image derivatives served by /img
 * (ImageResizeController) and warmed by the images:warm-derivatives command.
 * Keeps the width ladder + key scheme in one place so the two never drift.
 */
class ImageDerivatives
{
    /** Target widths (mirrored in lib/responsiveImage.ts on the frontend). */
    public const WIDTHS = [384, 640, 960, 1280, 1920];

    public const ALLOWED_EXT = ['webp', 'jpg', 'jpeg', 'png'];

    /**
     * Map one of our public asset URLs (CDN or the /assets/ stream route) to its
     * bucket-relative path (under the `public/` prefix). Null for anything that
     * isn't ours, so /img can't be used as an open proxy.
     */
    public static function relPath(?string $src): ?string
    {
        if (! $src) {
            return null;
        }

        $cdn = config('filesystems.disks.wasabi.cdn_url');
        if ($cdn && str_starts_with($src, rtrim($cdn, '/').'/')) {
            $rel = substr($src, strlen(rtrim($cdn, '/').'/'));
        } elseif (($pos = strpos($src, '/assets/')) !== false) {
            $rel = substr($src, $pos + strlen('/assets/'));
        } else {
            return null;
        }

        $rel = ltrim(explode('?', $rel)[0], '/');

        // Reject traversal, derivatives (avoid loops), and non-image extensions.
        if ($rel === '' || str_contains($rel, '..') || str_contains($rel, '/_rw/')) {
            return null;
        }
        if (! in_array(strtolower(pathinfo($rel, PATHINFO_EXTENSION)), self::ALLOWED_EXT, true)) {
            return null;
        }

        return $rel;
    }

    /** Bucket key for a derivative of `$rel` at width `$w`. */
    public static function derivativeKey(string $rel, int $w): string
    {
        $dir = trim(dirname($rel), '.');

        return 'public/'.($dir !== '' ? $dir.'/' : '')."_rw/{$w}/".pathinfo($rel, PATHINFO_FILENAME).'.webp';
    }

    /**
     * Ensure the width-`$w` WebP derivative of `$rel` exists (generating + caching
     * it once), and return its bucket key. Null if the source is missing or the
     * resize fails.
     */
    public static function ensure(string $rel, int $w): ?string
    {
        $disk = Storage::disk('wasabi');
        $key = self::derivativeKey($rel, $w);

        if ($disk->exists($key)) {
            return $key;
        }

        try {
            $bytes = $disk->get('public/'.$rel);
        } catch (\Throwable $e) {
            return null;
        }

        // Big originals can blow GD's default limits while decoding/resizing.
        @ini_set('memory_limit', '512M');
        @set_time_limit(60);

        try {
            // scaleDown never upscales, so a width above the source is a no-op.
            $webp = Images::webp($bytes, $w);
            $disk->put($key, $webp, ['visibility' => 'public', 'CacheControl' => 'public, max-age=31536000, immutable']);

            return $key;
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }
}
