<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Helpers for reading Wasabi (S3) objects in a php-fpm–safe way.
 *
 * Streaming to a temp file via the S3 client's SaveAs avoids the Guzzle
 * php://temp spill that 500s on large objects, and sys_get_temp_dir() is
 * writable by www-data. Centralised here so the gotcha lives in one place
 * (see the s3-download-tempnam memory note).
 */
class WasabiObject
{
    /**
     * Download an object to a local temp file and return its path. The caller
     * owns the file and must delete it (or use deleteFileAfterSend). Throws if
     * the object is missing/unreadable, cleaning up any partial temp file.
     */
    public static function toTempFile(string $key, string $disk = 'wasabi'): string
    {
        $client = Storage::disk($disk)->getClient();
        $bucket = config("filesystems.disks.{$disk}.bucket");
        $localPath = sys_get_temp_dir().'/'.Str::uuid();

        try {
            $client->getObject(['Bucket' => $bucket, 'Key' => $key, 'SaveAs' => $localPath]);
        } catch (\Throwable $e) {
            @unlink($localPath);
            throw $e;
        }

        return $localPath;
    }
}
