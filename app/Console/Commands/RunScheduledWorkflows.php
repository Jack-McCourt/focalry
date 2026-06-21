<?php

namespace App\Console\Commands;

use App\Models\ScheduledWorkflowAction;
use App\Services\WorkflowEngine;
use Illuminate\Console\Command;

class RunScheduledWorkflows extends Command
{
    protected $signature = 'workflows:run';

    protected $description = 'Run any delayed workflow steps whose scheduled time has arrived.';

    public function handle(WorkflowEngine $engine): int
    {
        // Cross-tenant: process every studio's due actions.
        $due = ScheduledWorkflowAction::withoutGlobalScopes()
            ->where('status', 'pending')
            ->where('run_at', '<=', now())
            ->with(['step', 'project.contact', 'project.studio'])
            ->limit(200)
            ->get();

        $count = 0;

        foreach ($due as $action) {
            if (! $action->step || ! $action->project) {
                $action->update(['status' => 'failed', 'result' => 'Missing step or project.']);

                continue;
            }

            $result = $engine->safeRunStep($action->step, $action->project);
            $action->update([
                'status' => str_starts_with($result, 'Failed') ? 'failed' : 'done',
                'result' => $result,
            ]);
            $count++;
        }

        $this->info("Processed {$count} scheduled workflow action(s).");

        return self::SUCCESS;
    }
}
