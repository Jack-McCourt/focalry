<?php

namespace App\Console\Commands;

use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\Studio;
use Illuminate\Console\Command;

class PruneStaleLeads extends Command
{
    /** How long a soft-deleted project sits in the trash before it's gone for good. */
    public const TRASH_RETENTION_DAYS = 30;

    protected $signature = 'leads:prune';

    protected $description = 'Soft-delete leads that have sat in the "Lead" status past each studio\'s retention window, and permanently remove projects trashed over 30 days ago.';

    public function handle(): int
    {
        $trashed = $this->softDeleteStaleLeads();
        $purged = $this->purgeOldTrash();

        $this->info("Trashed {$trashed} stale lead(s); permanently removed {$purged} project(s).");

        return self::SUCCESS;
    }

    /** Soft-delete leads still in the "Lead" status beyond each studio's window. */
    private function softDeleteStaleLeads(): int
    {
        // Cross-tenant: every studio that has opted in to auto-deleting leads.
        $studios = Studio::all()->filter(fn (Studio $s) => $s->leadSettings()['enabled']);

        $count = 0;

        foreach ($studios as $studio) {
            $settings = $studio->leadSettings();

            $cutoff = match ($settings['unit']) {
                'days' => now()->subDays($settings['value']),
                'weeks' => now()->subWeeks($settings['value']),
                default => now()->subMonths($settings['value']),
            };

            $leadStatusIds = ProjectStatus::withoutGlobalScopes()
                ->where('studio_id', $studio->id)
                ->where('label', 'Lead')
                ->pluck('id');

            if ($leadStatusIds->isEmpty()) {
                continue;
            }

            // Soft-delete one model at a time so SoftDeletes stamps deleted_at and
            // the retention clock starts cleanly.
            Project::withoutGlobalScopes()
                ->where('studio_id', $studio->id)
                ->whereIn('status_id', $leadStatusIds)
                ->whereNotNull('status_changed_at')
                ->where('status_changed_at', '<', $cutoff)
                ->each(function (Project $project) use (&$count) {
                    $project->delete();
                    $count++;
                });
        }

        return $count;
    }

    /** Permanently delete projects that have been in the trash past the retention window. */
    private function purgeOldTrash(): int
    {
        return Project::withoutGlobalScopes()
            ->onlyTrashed()
            ->where('deleted_at', '<', now()->subDays(self::TRASH_RETENTION_DAYS))
            ->forceDelete();
    }
}
