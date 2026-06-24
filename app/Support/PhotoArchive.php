<?php

namespace App\Support;

use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;
use ZipStream\ZipStream;

/**
 * Builds downloadable archives / files from Wasabi (S3) objects.
 *
 * Centralises the storage + temp-file handling so the php-fpm gotchas live in
 * one place: write to sys_get_temp_dir() (writable by www-data) and stream via
 * the S3 client's SaveAs (avoids Guzzle's php://temp spill). See the
 * s3-download-tempnam memory note.
 */
class PhotoArchive
{
    private string $disk;

    public function __construct(string $disk = 'wasabi')
    {
        $this->disk = $disk;
    }

    /**
     * Stream a ZIP of the given objects to the browser.
     *
     * The archive is streamed entry-by-entry: each object is pulled from S3 to a
     * single temp file (SaveAs avoids the php-fpm tempnam spill), written into the
     * output stream, then deleted before the next one. Bytes start flowing
     * immediately and only one object is ever on disk, so even a multi-GB
     * "download all" of originals won't blow disk or time out behind a proxy.
     *
     * @param  array<int, array{key: string, filename: string}>  $items
     */
    public function zip(array $items, string $downloadName): StreamedResponse
    {
        return response()->streamDownload(function () use ($items) {
            // A large archive can take a while; don't let PHP or an aborted client
            // leave us half-done.
            @set_time_limit(0);
            ignore_user_abort(false);

            $zip = new ZipStream(sendHttpHeaders: false);
            $usedNames = [];

            foreach ($items as $item) {
                if (empty($item['key'])) {
                    continue;
                }

                $localPath = null;
                try {
                    $localPath = WasabiObject::toTempFile($item['key'], $this->disk);
                    // addFileFromPath streams the whole file into the output before
                    // it returns, so the temp file is safe to delete straight after.
                    $zip->addFileFromPath($this->uniqueName($usedNames, $item['filename']), $localPath);
                } catch (\Throwable $e) {
                    // Skip a single bad/missing object rather than failing the lot.
                } finally {
                    if ($localPath) {
                        @unlink($localPath);
                    }
                }

                if (connection_aborted()) {
                    break;
                }
            }

            $zip->finish();
        }, $downloadName, [
            'Content-Type' => 'application/zip',
            // Stop nginx buffering the whole archive before the client sees anything.
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * Stream a single object as a download with the given filename.
     */
    public function file(string $key, string $downloadName): BinaryFileResponse
    {
        try {
            $localPath = WasabiObject::toTempFile($key, $this->disk);
        } catch (\Throwable $e) {
            abort(404, 'File not found.');
        }

        return response()
            ->download($localPath, $downloadName)
            ->deleteFileAfterSend(true);
    }

    /**
     * Preserve the original filename, disambiguating collisions ("name-1.jpg").
     */
    private function uniqueName(array &$used, string $filename): string
    {
        if (! isset($used[$filename])) {
            $used[$filename] = 0;

            return $filename;
        }

        $used[$filename]++;
        $ext = pathinfo($filename, PATHINFO_EXTENSION);
        $base = pathinfo($filename, PATHINFO_FILENAME);

        return $ext ? "{$base}-{$used[$filename]}.{$ext}" : "{$base}-{$used[$filename]}";
    }
}
