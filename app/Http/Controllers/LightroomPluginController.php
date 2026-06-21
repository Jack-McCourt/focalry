<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use ZipArchive;

class LightroomPluginController extends Controller
{
    /**
     * Build and download the Lightroom Classic plugin as a zip of the
     * `WeddingApp.lrplugin` bundle. Zipped on the fly so the download always
     * matches the committed plugin source.
     */
    public function download(): BinaryFileResponse|Response
    {
        $source = base_path('lightroom-plugin/WeddingApp.lrplugin');

        if (! is_dir($source)) {
            abort(404, 'Lightroom plugin not found.');
        }

        $zipPath = tempnam(sys_get_temp_dir(), 'lrplugin').'.zip';

        $zip = new ZipArchive;
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            abort(500, 'Could not build the plugin archive.');
        }

        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($source, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY,
        );

        foreach ($files as $file) {
            // Keep the WeddingApp.lrplugin/ folder as the archive root so it
            // unzips into a ready-to-install bundle.
            $relativePath = 'WeddingApp.lrplugin/'.substr($file->getRealPath(), strlen($source) + 1);
            $zip->addFile($file->getRealPath(), str_replace('\\', '/', $relativePath));
        }

        $zip->close();

        return response()->download($zipPath, 'WeddingApp.lrplugin.zip', [
            'Content-Type' => 'application/zip',
        ])->deleteFileAfterSend(true);
    }
}
