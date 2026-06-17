<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use ZipArchive;

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
     * Stream a ZIP of the given objects.
     *
     * @param  array<int, array{key: string, filename: string}>  $items
     */
    public function zip(array $items, string $downloadName): BinaryFileResponse
    {
        $client = Storage::disk($this->disk)->getClient();
        $bucket = config("filesystems.disks.{$this->disk}.bucket");
        $tmpDir = sys_get_temp_dir();

        $zipPath = $tmpDir.'/'.Str::uuid().'.zip';
        $zip = new ZipArchive;
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            abort(500, 'Unable to create the download archive.');
        }

        $tempFiles = [];
        $usedNames = [];

        foreach ($items as $item) {
            if (empty($item['key'])) {
                continue;
            }

            $localPath = $tmpDir.'/'.Str::uuid();
            try {
                $client->getObject([
                    'Bucket' => $bucket,
                    'Key' => $item['key'],
                    'SaveAs' => $localPath,
                ]);
            } catch (\Throwable $e) {
                @unlink($localPath);

                continue;
            }

            $tempFiles[] = $localPath;
            $zip->addFile($localPath, $this->uniqueName($usedNames, $item['filename']));
        }

        $zip->close();

        // Source files are copied into the archive on close(); safe to remove now.
        foreach ($tempFiles as $file) {
            @unlink($file);
        }

        return response()
            ->download($zipPath, $downloadName)
            ->deleteFileAfterSend(true);
    }

    /**
     * Stream a single object as a download with the given filename.
     */
    public function file(string $key, string $downloadName): BinaryFileResponse
    {
        $client = Storage::disk($this->disk)->getClient();
        $bucket = config("filesystems.disks.{$this->disk}.bucket");

        $localPath = sys_get_temp_dir().'/'.Str::uuid();
        try {
            $client->getObject([
                'Bucket' => $bucket,
                'Key' => $key,
                'SaveAs' => $localPath,
            ]);
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
