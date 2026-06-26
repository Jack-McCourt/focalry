<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\ProjectFieldDefinition;
use App\Models\ProjectStatus;
use App\Models\ProjectType;
use App\Models\QuestionnaireTemplate;
use App\Models\TaskTemplate;
use App\Models\Workflow;
use App\Models\WorkflowStep;
use App\Services\WorkflowConditionEvaluator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class WorkflowController extends Controller
{
    public function index(): Response
    {
        $workflows = Workflow::withCount(['steps', 'runs'])
            ->with('triggerStatus:id,label')
            ->orderBy('name')
            ->get()
            ->map(fn (Workflow $w) => [
                'id' => $w->id,
                'name' => $w->name,
                'trigger' => $w->trigger,
                'trigger_label' => Workflow::TRIGGERS[$w->trigger] ?? $w->trigger,
                'trigger_status' => $w->triggerStatus?->label,
                'conditions_count' => count($w->conditions ?? []),
                'is_active' => $w->is_active,
                'steps_count' => $w->steps_count,
                'runs_count' => $w->runs_count,
            ]);

        return Inertia::render('Workflows/Index', [
            'workflows' => $workflows,
            'triggers' => Workflow::TRIGGERS,
        ]);
    }

    public function create(): Response
    {
        return $this->form(new Workflow(['trigger' => 'project_status_changed', 'is_active' => true]));
    }

    public function edit(Workflow $workflow): Response
    {
        $workflow->load('steps');

        return $this->form($workflow);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateWorkflow($request);

        $workflow = DB::transaction(function () use ($data) {
            $workflow = Workflow::create([
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'trigger' => $data['trigger'],
                'trigger_status_id' => $data['trigger'] === 'project_status_changed' ? ($data['trigger_status_id'] ?? null) : null,
                'conditions' => $this->cleanConditions($data['conditions'] ?? []),
                'condition_match' => $data['condition_match'] ?? 'all',
                'is_active' => $data['is_active'] ?? true,
            ]);
            $this->syncSteps($workflow, $data['steps'] ?? []);

            return $workflow;
        });

        return redirect()->route('workflows.edit', $workflow)->with('success', 'Workflow saved.');
    }

    public function update(Request $request, Workflow $workflow): RedirectResponse
    {
        $data = $this->validateWorkflow($request);

        DB::transaction(function () use ($workflow, $data) {
            $workflow->update([
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'trigger' => $data['trigger'],
                'trigger_status_id' => $data['trigger'] === 'project_status_changed' ? ($data['trigger_status_id'] ?? null) : null,
                'conditions' => $this->cleanConditions($data['conditions'] ?? []),
                'condition_match' => $data['condition_match'] ?? 'all',
                'is_active' => $data['is_active'] ?? true,
            ]);
            $workflow->steps()->delete();
            $this->syncSteps($workflow, $data['steps'] ?? []);
        });

        return back()->with('success', 'Workflow updated.');
    }

    public function toggle(Workflow $workflow): RedirectResponse
    {
        $workflow->update(['is_active' => ! $workflow->is_active]);

        return back();
    }

    public function destroy(Workflow $workflow): RedirectResponse
    {
        $workflow->delete();

        return redirect()->route('workflows.index')->with('success', 'Workflow deleted.');
    }

    private function form(Workflow $workflow): Response
    {
        return Inertia::render('Workflows/Edit', [
            'workflow' => [
                'id' => $workflow->id,
                'name' => $workflow->name,
                'description' => $workflow->description,
                'trigger' => $workflow->trigger,
                'trigger_status_id' => $workflow->trigger_status_id,
                'conditions' => $workflow->conditions ?? [],
                'condition_match' => $workflow->condition_match ?: 'all',
                'is_active' => $workflow->is_active ?? true,
                'steps' => $workflow->relationLoaded('steps')
                    ? $workflow->steps->map(fn ($s) => [
                        'action' => $s->action,
                        'config' => $s->config ?? [],
                        'schedule_mode' => $s->schedule_mode ?: 'after_trigger',
                        'offset_value' => (int) $s->offset_value,
                        'offset_unit' => $s->offset_unit ?: 'day',
                    ])
                    : [],
            ],
            'triggers' => Workflow::TRIGGERS,
            'actions' => Workflow::ACTIONS,
            'schedule_modes' => WorkflowStep::SCHEDULE_MODES,
            'offset_units' => WorkflowStep::OFFSET_UNITS,
            'statuses' => ProjectStatus::orderBy('position')->get(['id', 'label', 'color']),
            'project_types' => ProjectType::orderBy('position')->get(['id', 'label', 'color']),
            'task_templates' => TaskTemplate::orderBy('name')->get(['id', 'name']),
            'questionnaire_templates' => QuestionnaireTemplate::orderBy('name')->get(['id', 'name']),
            'condition_operators' => Workflow::CONDITION_OPERATORS,
            'valueless_operators' => Workflow::VALUELESS_OPERATORS,
            'condition_fields' => $this->conditionFields(),
        ]);
    }

    /**
     * The fields a condition can test: built-in project attributes plus every
     * custom field the studio has defined (so workflows can branch on them).
     * Each field declares an input `kind` the front-end uses to render the value
     * picker (status/type dropdowns, custom-field selects, dates, plain text).
     *
     * @return array<int, array<string, mixed>>
     */
    private function conditionFields(): array
    {
        $builtin = [
            ['key' => 'type', 'label' => 'Project type', 'kind' => 'type'],
            ['key' => 'status', 'label' => 'Project status', 'kind' => 'status'],
            ['key' => 'event_date', 'label' => 'Event date', 'kind' => 'date'],
            ['key' => 'name', 'label' => 'Project name', 'kind' => 'text'],
        ];

        $custom = ProjectFieldDefinition::orderBy('position')->get()
            // image/file fields hold uploaded files, not values you can test against.
            ->reject(fn (ProjectFieldDefinition $f) => in_array($f->type, ['image', 'file'], true))
            ->map(fn (ProjectFieldDefinition $f) => [
                'key' => WorkflowConditionEvaluator::CUSTOM_FIELD_PREFIX.$f->key,
                'label' => $f->label,
                'kind' => $f->type,
                'options' => $f->options ?? [],
            ])
            ->all();

        return [...$builtin, ...$custom];
    }

    /**
     * Drop blank/incomplete condition rows so an empty UI row never silently
     * blocks a workflow.
     *
     * @param  array<int, array<string, mixed>>  $conditions
     * @return array<int, array<string, mixed>>
     */
    private function cleanConditions(array $conditions): array
    {
        $valueless = Workflow::VALUELESS_OPERATORS;

        return array_values(array_filter(array_map(function ($c) use ($valueless) {
            $field = trim((string) ($c['field'] ?? ''));
            $operator = (string) ($c['operator'] ?? 'equals');
            $value = $c['value'] ?? null;

            if ($field === '') {
                return null;
            }
            if (in_array($operator, $valueless, true)) {
                return ['field' => $field, 'operator' => $operator, 'value' => null];
            }

            // Date conditions carry a relative offset; everything else a scalar.
            if (is_array($value)) {
                $value = [
                    'amount' => max(0, (int) ($value['amount'] ?? 0)),
                    'unit' => in_array($value['unit'] ?? null, WorkflowStep::OFFSET_UNITS, true) ? $value['unit'] : 'day',
                    'anchor' => ($value['anchor'] ?? 'future') === 'past' ? 'past' : 'future',
                ];
            } elseif ($value === null || $value === '') {
                return null;
            }

            return ['field' => $field, 'operator' => $operator, 'value' => $value];
        }, $conditions)));
    }

    /**
     * @return array<string, mixed>
     */
    private function validateWorkflow(Request $request): array
    {
        return $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'trigger' => ['required', Rule::in(array_keys(Workflow::TRIGGERS))],
            'trigger_status_id' => 'nullable|integer|exists:project_statuses,id',
            'condition_match' => ['nullable', Rule::in(['all', 'any'])],
            'conditions' => 'array',
            'conditions.*.field' => 'required|string|max:255',
            'conditions.*.operator' => ['required', Rule::in(array_keys(Workflow::CONDITION_OPERATORS))],
            'conditions.*.value' => 'nullable',
            'is_active' => 'boolean',
            'steps' => 'array',
            'steps.*.action' => ['required', Rule::in(array_keys(Workflow::ACTIONS))],
            'steps.*.config' => 'nullable|array',
            'steps.*.schedule_mode' => ['nullable', Rule::in(array_keys(WorkflowStep::SCHEDULE_MODES))],
            'steps.*.offset_value' => 'nullable|integer|min:0|max:1000',
            'steps.*.offset_unit' => ['nullable', Rule::in(WorkflowStep::OFFSET_UNITS)],
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $steps
     */
    private function syncSteps(Workflow $workflow, array $steps): void
    {
        foreach (array_values($steps) as $i => $step) {
            $workflow->steps()->create([
                'position' => $i,
                'action' => $step['action'],
                'config' => $step['config'] ?? [],
                'schedule_mode' => $step['schedule_mode'] ?? 'after_trigger',
                'offset_value' => (int) ($step['offset_value'] ?? 0),
                'offset_unit' => $step['offset_unit'] ?? 'day',
            ]);
        }
    }
}
