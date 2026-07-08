<?php

namespace App\Console\Commands;

use App\Support\LinkedGalleries;
use Illuminate\Console\Command;

/**
 * Keeps live-linked gallery blocks on published sites in step with their
 * client-gallery Collections (new photos appear, removed ones drop out) —
 * no publish needed. Page writes touch the site, busting the page cache.
 */
class SyncLinkedGalleries extends Command
{
    protected $signature = 'site:sync-linked-galleries';

    protected $description = 'Refresh live-linked gallery blocks on published sites from their client galleries';

    public function handle(): int
    {
        $count = LinkedGalleries::syncAllPublished();
        $this->info("Checked {$count} published site(s).");

        return self::SUCCESS;
    }
}
