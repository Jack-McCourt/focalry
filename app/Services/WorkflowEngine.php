<?php

namespace App\Services;

use App\Mail\StudioEmail;
use App\Models\Project;
use App\Models\ProjectNote;
use App\Models\Questionnaire;
use App\Models\QuestionnaireTemplate;
use App\Models\ScheduledWorkflowAction;
use App\Models\Task;
use App\Models\TaskTemplate;
use App\Models\Workflow;
use App\Models\WorkflowRun;
use App\Models\WorkflowStep;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Runs studio automations. A trigger (project created, status changed, invoice
 * paid, contract signed, questionnaire completed) fans out to every active
 * matching workflow; each step runs immediately or is scheduled for later.
 *
 * Deliberately tenant-agnostic: it may run from a webhook or public controller
 * where no current studio is bound, so it always scopes by the project's studio
 * explicitly and never relies on the global studio scope.
 */
class WorkflowEngine
{
    /** Guard so a workflow that changes a project's status can't trigger itself. */
    private bool $suppressStatusTrigger = false;

    public function __construct(
        private readonly WorkflowConditionEvaluator $conditions = new WorkflowConditionEvaluator,
    ) {}

    /**
     * @param  array<string, mixed>  $context
     */
    public function dispatch(string $trigger, Project $project, array $context = []): void
    {
        if ($trigger === 'project_status_changed' && $this->suppressStatusTrigger) {
            return;
        }

        $workflows = Workflow::withoutGlobalScopes()
            ->where('studio_id', $project->studio_id)
            ->where('trigger', $trigger)
            ->where('is_active', true)
            ->when($trigger === 'project_status_changed', function ($q) use ($context) {
                $statusId = $context['status_id'] ?? $project->status_id;
                $q->where(fn ($w) => $w->whereNull('trigger_status_id')->orWhere('trigger_status_id', $statusId));
            })
            ->with('steps')
            ->get();

        foreach ($workflows as $workflow) {
            // "If" conditions narrow a trigger — e.g. only when the type is Wedding.
            if (! $this->conditions->passes($workflow, $project)) {
                continue;
            }

            $this->runWorkflow($workflow, $project);
        }
    }

    public function runWorkflow(Workflow $workflow, Project $project): void
    {
        WorkflowRun::create([
            'studio_id' => $workflow->studio_id,
            'workflow_id' => $workflow->id,
            'project_id' => $project->id,
            'triggered_at' => now(),
        ]);

        foreach ($workflow->steps as $step) {
            $runAt = $this->resolveRunAt($step, $project);

            if ($runAt === null) {
                $this->safeRunStep($step, $project);
            } else {
                ScheduledWorkflowAction::create([
                    'studio_id' => $workflow->studio_id,
                    'workflow_id' => $workflow->id,
                    'workflow_step_id' => $step->id,
                    'project_id' => $project->id,
                    'run_at' => $runAt,
                    'status' => 'pending',
                ]);
            }
        }
    }

    /**
     * When should this step run? Returns null to run immediately, otherwise the
     * scheduled time. A step can wait a fixed period after the trigger, or land
     * a number of days/weeks/months before or after the project's event date.
     * Event-relative steps with no event date fall back to running immediately
     * so the action is never silently dropped.
     */
    private function resolveRunAt(WorkflowStep $step, Project $project): ?Carbon
    {
        $mode = $step->schedule_mode ?: 'after_trigger';
        $value = (int) $step->offset_value;
        $unit = in_array($step->offset_unit, WorkflowStep::OFFSET_UNITS, true) ? $step->offset_unit : 'day';

        if ($mode === 'after_trigger') {
            return $value > 0 ? now()->add($unit, $value) : null;
        }

        $eventDate = $project->event_date ? Carbon::parse($project->event_date)->startOfDay() : null;
        if (! $eventDate) {
            return null;
        }

        return $mode === 'before_event'
            ? $eventDate->sub($unit, $value)
            : $eventDate->add($unit, $value);
    }

    /** Run a step, swallowing failures so one bad step can't break the chain. */
    public function safeRunStep(WorkflowStep $step, Project $project): string
    {
        try {
            return $this->runStep($step, $project);
        } catch (\Throwable $e) {
            report($e);
            Log::warning('Workflow step failed', ['step' => $step->id, 'error' => $e->getMessage()]);

            return 'Failed: '.$e->getMessage();
        }
    }

    public function runStep(WorkflowStep $step, Project $project): string
    {
        $project->loadMissing(['contact', 'studio']);
        $config = $step->config ?? [];

        return match ($step->action) {
            'send_email' => $this->sendEmail($project, $config),
            'create_task' => $this->createTask($project, $config),
            'apply_task_template' => $this->applyTaskTemplate($project, $config),
            'send_questionnaire' => $this->sendQuestionnaire($project, $config),
            'change_status' => $this->changeStatus($project, $config),
            'create_note' => $this->createNote($project, $config),
            default => 'Unknown action',
        };
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function sendEmail(Project $project, array $config): string
    {
        $email = $project->contact?->email;
        if (! $email) {
            return 'Skipped: client has no email.';
        }

        $subject = $this->merge($config['subject'] ?? 'A message from {{studio_name}}', $project);
        $body = $this->merge($config['body'] ?? '', $project);

        Mail::to($email)->send(new StudioEmail(
            studioName: $project->studio?->name ?: config('app.name'),
            subjectLine: $subject,
            bodyText: $body,
        ));

        return "Emailed {$email}.";
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function createTask(Project $project, array $config): string
    {
        $offset = (int) ($config['offset_days'] ?? 0);
        $base = $project->event_date ? Carbon::parse($project->event_date) : Carbon::today();

        Task::create([
            'studio_id' => $project->studio_id,
            'project_id' => $project->id,
            'title' => $config['title'] ?? 'Follow up',
            'due_date' => $base->copy()->addDays($offset)->toDateString(),
            'position' => (int) Task::withoutGlobalScopes()->where('project_id', $project->id)->max('position') + 1,
        ]);

        return 'Task created.';
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function applyTaskTemplate(Project $project, array $config): string
    {
        $template = TaskTemplate::withoutGlobalScopes()
            ->where('studio_id', $project->studio_id)
            ->with('items')
            ->find($config['template_id'] ?? null);

        if (! $template) {
            return 'Skipped: task checklist not found.';
        }

        $count = $template->applyTo($project);

        return "{$count} task(s) added from “{$template->name}”.";
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function sendQuestionnaire(Project $project, array $config): string
    {
        $template = QuestionnaireTemplate::withoutGlobalScopes()
            ->where('studio_id', $project->studio_id)
            ->find($config['template_id'] ?? null);

        if (! $template) {
            return 'Skipped: questionnaire template not found.';
        }

        $questionnaire = Questionnaire::create([
            'studio_id' => $project->studio_id,
            'project_id' => $project->id,
            'contact_id' => $project->contact_id,
            'questionnaire_template_id' => $template->id,
            'title' => $template->name,
            'status' => 'sent',
            'questions' => $template->questions,
            'sent_at' => now(),
        ]);

        $email = $project->contact?->email;
        if ($email) {
            Mail::to($email)->send(new StudioEmail(
                studioName: $project->studio?->name ?: config('app.name'),
                subjectLine: $this->merge("Please complete: {$template->name}", $project),
                bodyText: $this->merge("Hi {{client_first_name}},\n\nPlease take a few minutes to complete the questionnaire below — it helps us prepare for your big day.\n\nThank you,\n{{studio_name}}", $project),
                ctaLabel: 'Open questionnaire',
                ctaUrl: route('questionnaires.public.show', $questionnaire->public_id),
            ));

            return "Questionnaire sent to {$email}.";
        }

        return 'Questionnaire created (client has no email to send to).';
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function changeStatus(Project $project, array $config): string
    {
        $statusId = $config['status_id'] ?? null;
        if (! $statusId) {
            return 'Skipped: no status configured.';
        }

        // Suppress so moving status here doesn't recursively fire status workflows.
        $this->suppressStatusTrigger = true;
        $project->forceFill(['status_id' => $statusId])->save();
        $this->suppressStatusTrigger = false;

        return 'Project status updated.';
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function createNote(Project $project, array $config): string
    {
        ProjectNote::create([
            'studio_id' => $project->studio_id,
            'project_id' => $project->id,
            'body' => $this->merge($config['body'] ?? '', $project),
        ]);

        return 'Note added.';
    }

    /** Replace {{tokens}} in a string with project/client/studio values. */
    private function merge(string $text, Project $project): string
    {
        $values = [
            'client_name' => $project->contact?->name ?? '',
            'client_first_name' => $project->contact?->first_name ?: 'there',
            'project_name' => $project->name ?? '',
            'event_date' => $project->event_date?->format('F j, Y') ?? '',
            'studio_name' => $project->studio?->name ?: config('app.name'),
        ];

        return preg_replace_callback(
            '/\{\{\s*(\w+)\s*\}\}/',
            fn (array $m) => array_key_exists($m[1], $values) ? $values[$m[1]] : $m[0],
            $text,
        );
    }
}
