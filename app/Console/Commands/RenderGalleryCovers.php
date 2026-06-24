<?php

namespace App\Console\Commands;

use App\Jobs\RenderCoverDerivative;
use App\Models\Collection;
use Illuminate\Console\Command;

/**
 * Queues high-res (1920px) cover derivatives for existing collections whose
 * cover photo doesn't have one yet (covers predating the cover derivative).
 */
class RenderGalleryCovers extends Command
{
    protected $signature = 'gallery:render-covers {--sync : Render immediately instead of queueing}';

    protected $description = 'Generate 1920px cover derivatives for existing gallery covers';

    public function handle(): int
    {
        $queued = 0;

        Collection::withoutGlobalScopes()
            ->whereNotNull('cover_photo_id')
            ->with('coverPhoto:id,studio_id,collection_id,wasabi_key_original,derivative_keys')
            ->chunkById(200, function ($collections) use (&$queued) {
                foreach ($collections as $c) {
                    $cover = $c->coverPhoto;
                    if (! $cover || ! $cover->wasabi_key_original || $cover->derivativeKey('cover')) {
                        continue;
                    }
                    $this->option('sync')
                        ? RenderCoverDerivative::dispatchSync($cover->id)
                        : RenderCoverDerivative::dispatch($cover->id);
                    $queued++;
                    $this->line("  cover for collection {$c->id} (photo {$cover->id})");
                }
            });

        $this->info(($this->option('sync') ? 'Rendered ' : 'Queued ')."{$queued} cover(s).");

        return self::SUCCESS;
    }
}
