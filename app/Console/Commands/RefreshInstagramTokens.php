<?php

namespace App\Console\Commands;

use App\Models\Site;
use App\Support\InstagramApi;
use Illuminate\Console\Command;

/**
 * Long-lived Instagram tokens last ~60 days and must be refreshed while still
 * valid. Runs weekly; refreshes anything expiring within the next 21 days.
 */
class RefreshInstagramTokens extends Command
{
    protected $signature = 'instagram:refresh-tokens';

    protected $description = 'Refresh Instagram tokens expiring soon (feed block connections)';

    public function handle(): int
    {
        $sites = Site::withoutGlobalScopes()
            ->whereNotNull('instagram_token')
            ->where('instagram_token_expires_at', '<', now()->addDays(21))
            ->get();

        foreach ($sites as $site) {
            try {
                $fresh = InstagramApi::refresh($site->instagram_token);
                $site->update([
                    'instagram_token' => $fresh['token'],
                    'instagram_token_expires_at' => $fresh['expires_at'],
                ]);
                $this->info("Refreshed site {$site->id}");
            } catch (\Throwable $e) {
                report($e);
                $this->warn("Failed for site {$site->id}: {$e->getMessage()}");
            }
        }

        return self::SUCCESS;
    }
}
