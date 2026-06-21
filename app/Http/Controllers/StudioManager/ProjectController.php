<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\ProjectFieldDefinition;
use App\Models\ProjectStatus;
use App\Models\ProjectType;
use App\Services\WorkflowEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function index(Request $request): Response
    {
        $this->ensureDefaults();

        $search = trim((string) $request->input('search', ''));
        $statusId = $request->integer('status') ?: null;
        $typeId = $request->integer('type') ?: null;

        $projects = Project::query()
            ->with([
                'status:id,label,color',
                'type:id,label,color',
                'contact:id,first_name,last_name,company',
            ])
            ->when($search !== '', fn ($q) => $q->where('name', 'like', "%{$search}%"))
            ->when($statusId, fn ($q) => $q->where('status_id', $statusId))
            ->when($typeId, fn ($q) => $q->where('type_id', $typeId))
            ->orderBy('position')
            ->latest('event_date')
            ->get()
            ->map(fn (Project $p) => $this->serialize($p));

        return Inertia::render('Projects/Index', [
            'projects' => $projects,
            'statuses' => ProjectStatus::orderBy('position')->get(['id', 'label', 'color']),
            'types' => ProjectType::orderBy('position')->get(['id', 'label', 'color']),
            'fields' => ProjectFieldDefinition::orderBy('position')->get(['id', 'key', 'label', 'type', 'options']),
            'contacts' => $this->contactOptions(),
            'filters' => ['search' => $search, 'status' => $statusId, 'type' => $typeId],
            'view' => in_array($request->input('view'), ['grid', 'kanban', 'calendar'], true)
                ? $request->input('view')
                : 'grid',
            'preselect_contact_id' => $request->integer('client') ?: null,
            'open_project_id' => $request->integer('open') ?: null,
        ]);
    }

    public function show(Project $project): JsonResponse
    {
        $project->load(['invoices' => fn ($q) => $q->orderByDesc('id'), 'contracts' => fn ($q) => $q->orderByDesc('id'), 'noteEntries', 'collections']);

        return response()->json([
            'galleries' => $project->collections->map(fn ($c) => [
                'id' => $c->id,
                'title' => $c->title,
                'status' => $c->status,
            ]),
            'invoices' => $project->invoices->map(fn (Invoice $i) => [
                'id' => $i->id,
                'public_id' => $i->public_id,
                'number' => $i->number,
                'status' => $i->status,
                'currency' => $i->currency,
                'total_cents' => $i->total_cents,
                'amount_paid_cents' => $i->amount_paid_cents,
                'balance_cents' => $i->balanceCents(),
            ]),
            'contracts' => $project->contracts->map(fn ($c) => [
                'id' => $c->id,
                'title' => $c->title,
                'status' => $c->status,
            ]),
            'notes' => $project->noteEntries->map(fn ($n) => [
                'id' => $n->id,
                'body' => $n->body,
                'created_at' => $n->created_at->toIso8601String(),
            ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateProject($request, creating: true);

        // New projects land at the end of their status column.
        $data['position'] = (int) Project::where('status_id', $data['status_id'] ?? null)->max('position') + 1;

        $project = Project::create($data);

        app(WorkflowEngine::class)->dispatch('project_created', $project);
        if ($project->status_id) {
            app(WorkflowEngine::class)->dispatch('project_status_changed', $project, ['status_id' => $project->status_id]);
        }

        return back()->with('success', 'Project created.');
    }

    public function update(Request $request, Project $project): RedirectResponse
    {
        $previousStatusId = $project->status_id;
        $project->update($this->validateProject($request, creating: false));

        if ($project->status_id && $project->status_id !== $previousStatusId) {
            app(WorkflowEngine::class)->dispatch('project_status_changed', $project, ['status_id' => $project->status_id]);
        }

        return back()->with('success', 'Project updated.');
    }

    public function destroy(Project $project): RedirectResponse
    {
        $project->delete();

        return back()->with('success', 'Project deleted.');
    }

    /**
     * Kanban drag: move a project to a status column and persist the new ordering
     * of that column. `ordered_ids` is the full ordered list of cards in the target column.
     */
    public function move(Request $request, Project $project): RedirectResponse
    {
        $validated = $request->validate([
            'status_id' => 'required|integer|exists:project_statuses,id',
            'ordered_ids' => 'array',
            'ordered_ids.*' => 'integer',
        ]);

        $statusChanged = $project->status_id !== (int) $validated['status_id'];

        DB::transaction(function () use ($validated) {
            foreach ($validated['ordered_ids'] as $i => $id) {
                // whereKey is studio-scoped via the global scope, so cross-tenant ids are ignored.
                Project::whereKey($id)->update([
                    'status_id' => $validated['status_id'],
                    'position' => $i,
                ]);
            }
        });

        if ($statusChanged) {
            app(WorkflowEngine::class)->dispatch(
                'project_status_changed',
                $project->refresh(),
                ['status_id' => (int) $validated['status_id']],
            );
        }

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function validateProject(Request $request, bool $creating): array
    {
        return $request->validate([
            'name' => ($creating ? 'required' : 'sometimes').'|string|max:255',
            'event_date' => 'sometimes|nullable|date',
            'status_id' => 'sometimes|nullable|integer|exists:project_statuses,id',
            'type_id' => 'sometimes|nullable|integer|exists:project_types,id',
            // A project belongs to a client — required, and can be reassigned but not cleared.
            'contact_id' => ($creating ? 'required' : 'sometimes').'|integer|exists:contacts,id',
            'collection_id' => 'sometimes|nullable|integer|exists:collections,id',
            'notes' => 'sometimes|nullable|string|max:20000',
            'custom_fields' => 'sometimes|nullable|array',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Project $p): array
    {
        return [
            'id' => $p->id,
            'name' => $p->name,
            'event_date' => $p->event_date?->toDateString(),
            'status_id' => $p->status_id,
            'type_id' => $p->type_id,
            'contact_id' => $p->contact_id,
            'contact' => $p->contact ? ['id' => $p->contact->id, 'name' => $p->contact->name] : null,
            'notes' => $p->notes,
            'custom_fields' => $p->custom_fields ?? [],
            'position' => $p->position,
        ];
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function contactOptions()
    {
        return Contact::orderBy('first_name')->orderBy('last_name')
            ->get(['id', 'first_name', 'last_name', 'company'])
            ->map(fn (Contact $c) => ['id' => $c->id, 'name' => $c->name]);
    }

    private function ensureDefaults(): void
    {
        if (ProjectStatus::count() === 0) {
            ProjectStatus::seedDefaults();
        }
        if (ProjectType::count() === 0) {
            ProjectType::seedDefaults();
        }
    }
}
