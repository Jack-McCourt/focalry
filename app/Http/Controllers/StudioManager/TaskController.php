<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskTemplate;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TaskController extends Controller
{
    public function index(Request $request): Response
    {
        $filter = $request->input('filter', 'open'); // open | done | all
        $projectId = $request->integer('project') ?: null;
        $assignee = $request->input('assignee'); // 'me' | user id | null

        $tasks = Task::query()
            ->with(['project:id,name', 'assignee:id,name'])
            ->when($filter === 'open', fn ($q) => $q->whereNull('completed_at'))
            ->when($filter === 'done', fn ($q) => $q->whereNotNull('completed_at'))
            ->when($projectId, fn ($q) => $q->where('project_id', $projectId))
            ->when($assignee === 'me', fn ($q) => $q->where('assigned_to', $request->user()->id))
            ->when(is_numeric($assignee), fn ($q) => $q->where('assigned_to', (int) $assignee))
            ->orderByRaw('due_date is null, due_date asc')
            ->orderBy('position')
            ->get()
            ->map(fn (Task $t) => $this->serialize($t));

        return Inertia::render('Tasks/Index', [
            'tasks' => $tasks,
            'projects' => $this->projectOptions(),
            'members' => $this->memberOptions($request),
            'templates' => TaskTemplate::with('items:id,task_template_id,title,offset_days,position')
                ->orderBy('name')->get(['id', 'name']),
            'filters' => ['filter' => $filter, 'project' => $projectId, 'assignee' => $assignee],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateTask($request, creating: true);
        $data['position'] = (int) Task::where('project_id', $data['project_id'] ?? null)->max('position') + 1;

        Task::create($data);

        return back()->with('success', 'Task added.');
    }

    public function update(Request $request, Task $task): RedirectResponse
    {
        $task->update($this->validateTask($request, creating: false));

        return back()->with('success', 'Task updated.');
    }

    public function toggle(Task $task): RedirectResponse
    {
        $task->update(['completed_at' => $task->completed_at ? null : now()]);

        return back();
    }

    public function destroy(Task $task): RedirectResponse
    {
        $task->delete();

        return back()->with('success', 'Task deleted.');
    }

    public function applyTemplate(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'template_id' => 'required|integer|exists:task_templates,id',
            'project_id' => 'required|integer|exists:projects,id',
        ]);

        $template = TaskTemplate::with('items')->findOrFail($data['template_id']);
        $project = Project::findOrFail($data['project_id']);
        $count = $template->applyTo($project);

        return back()->with('success', "{$count} task(s) added to {$project->name}.");
    }

    /**
     * @return array<string, mixed>
     */
    private function validateTask(Request $request, bool $creating): array
    {
        return $request->validate([
            'title' => ($creating ? 'required' : 'sometimes').'|string|max:255',
            'notes' => 'sometimes|nullable|string|max:5000',
            'due_date' => 'sometimes|nullable|date',
            'project_id' => 'sometimes|nullable|integer|exists:projects,id',
            'assigned_to' => 'sometimes|nullable|integer|exists:users,id',
        ]);
    }

    private function serialize(Task $t): array
    {
        return [
            'id' => $t->id,
            'title' => $t->title,
            'notes' => $t->notes,
            'due_date' => $t->due_date?->toDateString(),
            'completed_at' => $t->completed_at?->toIso8601String(),
            'project' => $t->project ? ['id' => $t->project->id, 'name' => $t->project->name] : null,
            'project_id' => $t->project_id,
            'assignee' => $t->assignee ? ['id' => $t->assignee->id, 'name' => $t->assignee->name] : null,
            'assigned_to' => $t->assigned_to,
        ];
    }

    private function projectOptions()
    {
        return Project::orderByDesc('event_date')->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Project $p) => ['id' => $p->id, 'name' => $p->name]);
    }

    private function memberOptions(Request $request)
    {
        return User::where('studio_id', $request->user()->studio_id)
            ->orderBy('name')->get(['id', 'name'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name]);
    }
}
