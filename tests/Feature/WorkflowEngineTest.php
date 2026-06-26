<?php

use App\Mail\StudioEmail;
use App\Models\Contact;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\Questionnaire;
use App\Models\QuestionnaireTemplate;
use App\Models\ScheduledWorkflowAction;
use App\Models\Studio;
use App\Models\Task;
use App\Models\TaskTemplate;
use App\Models\User;
use App\Models\Workflow;
use App\Services\WorkflowEngine;
use Illuminate\Support\Facades\Mail;

function wfStudio(): array
{
    $studio = Studio::factory()->onPaidPlan()->create();
    $user = User::factory()->for($studio)->create();
    app()->instance('current.studio.id', $studio->id);

    return [$studio, $user];
}

function wfProject(Studio $studio): Project
{
    $contact = Contact::create(['studio_id' => $studio->id, 'first_name' => 'Sam', 'last_name' => 'Lee', 'email' => 'sam@example.com']);

    return Project::create([
        'studio_id' => $studio->id,
        'name' => 'Sam & Alex Wedding',
        'contact_id' => $contact->id,
        'event_date' => '2026-09-01',
    ]);
}

it('runs immediate steps when a workflow trigger fires', function () {
    Mail::fake();
    [$studio] = wfStudio();
    $project = wfProject($studio);

    $workflow = Workflow::create([
        'studio_id' => $studio->id,
        'name' => 'Welcome',
        'trigger' => 'invoice_paid',
        'is_active' => true,
    ]);
    $workflow->steps()->create(['position' => 0, 'action' => 'create_task', 'config' => ['title' => 'Send welcome guide', 'offset_days' => -30], 'delay_days' => 0]);
    $workflow->steps()->create(['position' => 1, 'action' => 'send_email', 'config' => ['subject' => 'Welcome {{client_first_name}}', 'body' => 'Hi {{client_first_name}}'], 'delay_days' => 0]);

    app(WorkflowEngine::class)->dispatch('invoice_paid', $project);

    expect(Task::where('project_id', $project->id)->count())->toBe(1);
    expect(Task::where('project_id', $project->id)->first()->due_date->toDateString())->toBe('2026-08-02'); // 30 days before event
    Mail::assertSent(StudioEmail::class);
});

it('schedules delayed steps instead of running them immediately', function () {
    [$studio] = wfStudio();
    $project = wfProject($studio);

    $workflow = Workflow::create(['studio_id' => $studio->id, 'name' => 'Later', 'trigger' => 'project_created', 'is_active' => true]);
    $workflow->steps()->create([
        'position' => 0, 'action' => 'create_note', 'config' => ['body' => 'Follow up'],
        'schedule_mode' => 'after_trigger', 'offset_value' => 3, 'offset_unit' => 'day',
    ]);

    app(WorkflowEngine::class)->dispatch('project_created', $project);

    expect($project->noteEntries()->count())->toBe(0);
    expect(ScheduledWorkflowAction::where('project_id', $project->id)->where('status', 'pending')->count())->toBe(1);
});

it('schedules a step relative to the event date', function () {
    [$studio] = wfStudio();
    $project = wfProject($studio); // event_date = 2026-09-01

    $workflow = Workflow::create(['studio_id' => $studio->id, 'name' => 'Pre-wedding', 'trigger' => 'invoice_paid', 'is_active' => true]);
    // Two weeks before the event.
    $workflow->steps()->create([
        'position' => 0, 'action' => 'send_questionnaire', 'config' => ['template_id' => 0],
        'schedule_mode' => 'before_event', 'offset_value' => 2, 'offset_unit' => 'week',
    ]);
    // One month after the event.
    $workflow->steps()->create([
        'position' => 1, 'action' => 'create_task', 'config' => ['title' => 'Album follow-up'],
        'schedule_mode' => 'after_event', 'offset_value' => 1, 'offset_unit' => 'month',
    ]);

    app(WorkflowEngine::class)->dispatch('invoice_paid', $project);

    $runs = ScheduledWorkflowAction::where('project_id', $project->id)->orderBy('id')->get();
    expect($runs)->toHaveCount(2);
    expect($runs[0]->run_at->toDateString())->toBe('2026-08-18'); // 2 weeks before 1 Sep
    expect($runs[1]->run_at->toDateString())->toBe('2026-10-01'); // 1 month after 1 Sep
});

it('runs an event-relative step immediately when the project has no event date', function () {
    Mail::fake();
    [$studio] = wfStudio();
    $contact = Contact::create(['studio_id' => $studio->id, 'first_name' => 'Jo', 'email' => 'jo@example.com']);
    $project = Project::create(['studio_id' => $studio->id, 'name' => 'No date', 'contact_id' => $contact->id, 'event_date' => null]);

    $workflow = Workflow::create(['studio_id' => $studio->id, 'name' => 'No date', 'trigger' => 'project_created', 'is_active' => true]);
    $workflow->steps()->create([
        'position' => 0, 'action' => 'create_task', 'config' => ['title' => 'Reach out'],
        'schedule_mode' => 'before_event', 'offset_value' => 1, 'offset_unit' => 'week',
    ]);

    app(WorkflowEngine::class)->dispatch('project_created', $project);

    expect(ScheduledWorkflowAction::where('project_id', $project->id)->count())->toBe(0);
    expect(Task::where('project_id', $project->id)->count())->toBe(1);
});

it('only fires status workflows for the matching status', function () {
    Mail::fake();
    [$studio] = wfStudio();
    $project = wfProject($studio);
    $booked = ProjectStatus::create(['studio_id' => $studio->id, 'label' => 'Booked', 'color' => '#000', 'position' => 0]);
    $editing = ProjectStatus::create(['studio_id' => $studio->id, 'label' => 'Editing', 'color' => '#111', 'position' => 1]);

    $workflow = Workflow::create([
        'studio_id' => $studio->id, 'name' => 'On booked', 'trigger' => 'project_status_changed',
        'trigger_status_id' => $booked->id, 'is_active' => true,
    ]);
    $workflow->steps()->create(['position' => 0, 'action' => 'create_task', 'config' => ['title' => 'Kickoff'], 'delay_days' => 0]);

    // Wrong status — should not fire.
    app(WorkflowEngine::class)->dispatch('project_status_changed', $project, ['status_id' => $editing->id]);
    expect(Task::where('project_id', $project->id)->count())->toBe(0);

    // Matching status — fires.
    app(WorkflowEngine::class)->dispatch('project_status_changed', $project, ['status_id' => $booked->id]);
    expect(Task::where('project_id', $project->id)->count())->toBe(1);
});

it('completing a public questionnaire stores answers and triggers automations', function () {
    [$studio] = wfStudio();
    $project = wfProject($studio);

    $workflow = Workflow::create(['studio_id' => $studio->id, 'name' => 'After form', 'trigger' => 'questionnaire_completed', 'is_active' => true]);
    $workflow->steps()->create(['position' => 0, 'action' => 'create_task', 'config' => ['title' => 'Review answers'], 'delay_days' => 0]);

    $q = Questionnaire::create([
        'studio_id' => $studio->id,
        'project_id' => $project->id,
        'title' => 'Details',
        'status' => 'sent',
        'questions' => [['key' => 'venue', 'label' => 'Venue', 'type' => 'text', 'options' => [], 'required' => true]],
    ]);

    // Public submission (no tenant bound).
    app()->forgetInstance('current.studio.id');
    app()->instance('current.studio.id', null);

    $this->post("/q/{$q->public_id}", ['answers' => ['venue' => 'The Barn']])
        ->assertRedirect();

    $q->refresh();
    expect($q->status)->toBe('completed');
    expect($q->answers['venue'])->toBe('The Barn');
    expect(Task::withoutGlobalScopes()->where('project_id', $project->id)->where('title', 'Review answers')->count())->toBe(1);
});

it('applies a task template relative to the event date', function () {
    [$studio] = wfStudio();
    $project = wfProject($studio);

    $template = TaskTemplate::create(['studio_id' => $studio->id, 'name' => 'Delivery']);
    $template->items()->create(['title' => 'Cull', 'offset_days' => 2, 'position' => 0]);
    $template->items()->create(['title' => 'Deliver gallery', 'offset_days' => 21, 'position' => 1]);

    $created = $template->applyTo($project);

    expect($created)->toBe(2);
    expect(Task::where('project_id', $project->id)->pluck('due_date')->map->toDateString()->all())
        ->toContain('2026-09-03', '2026-09-22');
});

it('skips a workflow when its conditions are not met', function () {
    [$studio] = wfStudio();
    $wedding = App\Models\ProjectType::create(['studio_id' => $studio->id, 'label' => 'Wedding', 'color' => '#000', 'position' => 0]);
    $portrait = App\Models\ProjectType::create(['studio_id' => $studio->id, 'label' => 'Portrait', 'color' => '#111', 'position' => 1]);

    $project = wfProject($studio);
    $project->update(['type_id' => $portrait->id]);

    $workflow = Workflow::create([
        'studio_id' => $studio->id, 'name' => 'Weddings only', 'trigger' => 'invoice_paid', 'is_active' => true,
        'conditions' => [['field' => 'type', 'operator' => 'equals', 'value' => (string) $wedding->id]],
        'condition_match' => 'all',
    ]);
    $workflow->steps()->create(['position' => 0, 'action' => 'create_task', 'config' => ['title' => 'Kickoff'], 'delay_days' => 0]);

    // Portrait project — condition fails, nothing runs.
    app(WorkflowEngine::class)->dispatch('invoice_paid', $project);
    expect(Task::where('project_id', $project->id)->count())->toBe(0);

    // Switch the project to a wedding — now it runs.
    $project->update(['type_id' => $wedding->id]);
    app(WorkflowEngine::class)->dispatch('invoice_paid', $project);
    expect(Task::where('project_id', $project->id)->count())->toBe(1);
});

it('matches conditions against custom fields', function () {
    [$studio] = wfStudio();
    $project = wfProject($studio);
    $project->update(['custom_fields' => ['package' => 'Gold', 'guests' => 150]]);

    $workflow = Workflow::create([
        'studio_id' => $studio->id, 'name' => 'Big golds', 'trigger' => 'invoice_paid', 'is_active' => true,
        'conditions' => [
            ['field' => 'cf:package', 'operator' => 'equals', 'value' => 'Gold'],
            ['field' => 'cf:guests', 'operator' => 'greater_than', 'value' => '100'],
        ],
        'condition_match' => 'all',
    ]);
    $workflow->steps()->create(['position' => 0, 'action' => 'create_task', 'config' => ['title' => 'VIP prep'], 'delay_days' => 0]);

    app(WorkflowEngine::class)->dispatch('invoice_paid', $project);
    expect(Task::where('project_id', $project->id)->count())->toBe(1);

    // Drop below the guest threshold — the ALL match now fails.
    $project->update(['custom_fields' => ['package' => 'Gold', 'guests' => 50]]);
    app(WorkflowEngine::class)->dispatch('invoice_paid', $project);
    expect(Task::where('project_id', $project->id)->count())->toBe(1);
});

it('runs when any condition matches under the "any" mode', function () {
    [$studio] = wfStudio();
    $project = wfProject($studio);
    $project->update(['custom_fields' => ['vip' => true]]);

    $workflow = Workflow::create([
        'studio_id' => $studio->id, 'name' => 'Either', 'trigger' => 'invoice_paid', 'is_active' => true,
        'conditions' => [
            ['field' => 'cf:package', 'operator' => 'equals', 'value' => 'Gold'], // false
            ['field' => 'cf:vip', 'operator' => 'is_set', 'value' => null],        // true
        ],
        'condition_match' => 'any',
    ]);
    $workflow->steps()->create(['position' => 0, 'action' => 'create_task', 'config' => ['title' => 'Reach out'], 'delay_days' => 0]);

    app(WorkflowEngine::class)->dispatch('invoice_paid', $project);
    expect(Task::where('project_id', $project->id)->count())->toBe(1);
});

it('matches a date field against a relative offset from today', function () {
    [$studio] = wfStudio();
    $contact = Contact::create(['studio_id' => $studio->id, 'first_name' => 'Mo', 'email' => 'mo@example.com']);

    // Event is 10 days away.
    $project = Project::create(['studio_id' => $studio->id, 'name' => 'Soon', 'contact_id' => $contact->id, 'event_date' => now()->addDays(10)->toDateString()]);

    // Fires only when the event is within 2 weeks (event date is before "2 weeks from now").
    $workflow = Workflow::create([
        'studio_id' => $studio->id, 'name' => 'Final details', 'trigger' => 'invoice_paid', 'is_active' => true,
        'conditions' => [['field' => 'event_date', 'operator' => 'less_than', 'value' => ['amount' => 2, 'unit' => 'week', 'anchor' => 'future']]],
        'condition_match' => 'all',
    ]);
    $workflow->steps()->create(['position' => 0, 'action' => 'create_task', 'config' => ['title' => 'Confirm timeline'], 'delay_days' => 0]);

    app(WorkflowEngine::class)->dispatch('invoice_paid', $project);
    expect(Task::where('project_id', $project->id)->count())->toBe(1);

    // Push the event 90 days out — now it's after the 2-week anchor, so nothing runs.
    $project->update(['event_date' => now()->addDays(90)->toDateString()]);
    app(WorkflowEngine::class)->dispatch('invoice_paid', $project);
    expect(Task::where('project_id', $project->id)->count())->toBe(1);
});

it('seeds default questionnaire questions', function () {
    [$studio] = wfStudio();
    QuestionnaireTemplate::seedDefaults();

    expect(QuestionnaireTemplate::where('name', 'Wedding details')->exists())->toBeTrue();
});
