<?php

namespace App\Support;

use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Image;
use Intervention\Image\ImageManager;

/**
 * Thin wrapper over Intervention Image so the driver choice and encoder
 * settings live in one place instead of being re-instantiated at every call
 * site. `$source` may be a file path or raw binary string (both accepted by
 * Intervention's read()).
 */
class Images
{
    public static function manager(): ImageManager
    {
        return new ImageManager(new Driver);
    }

    /** Read + scale down to $maxWidth, ready for encoding/watermarking. */
    public static function read(string $source, int $maxWidth): Image
    {
        return self::manager()->read($source)->scaleDown($maxWidth);
    }

    /** Scale down to $maxWidth and encode as WebP. */
    public static function webp(string $source, int $maxWidth, int $quality = 82): string
    {
        return self::read($source, $maxWidth)->toWebp($quality)->toString();
    }

    /** Scale down to $maxWidth and encode as JPEG. */
    public static function jpeg(string $source, int $maxWidth, int $quality = 85): string
    {
        return self::read($source, $maxWidth)->toJpeg($quality)->toString();
    }
}
