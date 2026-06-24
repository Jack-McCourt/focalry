<?php

namespace App\Console\Commands;

use App\Models\Photo;
use App\Support\Images;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Generates the ~600px "grid" derivative for photos processed before it
 * existed. Downscales from the existing 1200px "web" derivative (cheap) rather
 * than re-reading the full original, so it can run over a large library fast.
 */
class BackfillGridDerivatives extends Command
{
    protected $signature = 'photos:backfill-grid {--force : Regenerate even if a grid derivative already exists}';

    protected $description = 'Create the mid-size (600px) gallery grid derivative for existing photos';

    public function handle(): int
    {
        $disk = Storage::disk('wasabi');

        $query = Photo::withoutGlobalScopes()->where('status', 'ready');

        $total = $query->count();
        $this->info("Scanning {$total} ready photos…");

        $made = 0;
        $skipped = 0;
        $failed = 0;

        $query->orderBy('id')->chunkById(200, function ($photos) use ($disk, &$made, &$skipped, &$failed) {
            foreach ($photos as $photo) {
                $keys = $photo->derivative_keys ?? [];

                if (! $this->option('force') && ! empty($keys['grid'])) {
                    $skipped++;

                    continue;
                }

                // Prefer the web derivative as the source; fall back to preview.
                $source = $keys['web'] ?? $keys['preview'] ?? null;
                if (! $source || ! $disk->exists($source)) {
                    $failed++;
                    $this->warn("  photo {$photo->id}: no web/preview source, skipping");

                    continue;
                }

                try {
                    $gridKey = "studios/{$photo->studio_id}/collections/{$photo->collection_id}/photos/{$photo->id}/grid.jpg";
                    $disk->put($gridKey, Images::jpeg($disk->get($source), 600, 82));

                    $keys['grid'] = $gridKey;
                    $photo->forceFill(['derivative_keys' => $keys])->saveQuietly();
                    $made++;
                } catch (Throwable $e) {
                    $failed++;
                    $this->warn("  photo {$photo->id}: {$e->getMessage()}");
                }
            }

            $this->line("  …{$made} created, {$skipped} skipped, {$failed} failed");
        });

        $this->info("Done. {$made} created, {$skipped} skipped, {$failed} failed.");

        return self::SUCCESS;
    }
}
