<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Questionnaire;
use App\Models\QuestionnaireTemplate;
use App\Support\ClientEmailContent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class QuestionnaireController extends Controller
{
    public function index(Request $request): Response
    {
        $status = $request->input('status');

        $questionnaires = Questionnaire::query()
            ->with(['project:id,name', 'contact:id,first_name,last_name,company'])
            ->when(in_array($status, ['draft', 'sent', 'completed'], true), fn ($q) => $q->where('status', $status))
            ->latest()
            ->get()
            ->map(fn (Questionnaire $q) => [
                'id' => $q->id,
                'title' => $q->title,
                'status' => $q->status,
                'project' => $q->project ? ['id' => $q->project->id, 'name' => $q->project->name] : null,
                'contact' => $q->contact ? ['name' => $q->contact->name] : null,
                'updated_at' => $q->updated_at->toDateString(),
            ]);

        return Inertia::render('Questionnaires/Index', [
            'questionnaires' => $questionnaires,
            'filters' => ['status' => $status],
        ]);
    }

    public function create(Request $request): Response
    {
        if (QuestionnaireTemplate::count() === 0) {
            QuestionnaireTemplate::seedDefaults();
        }

        return Inertia::render('Questionnaires/Create', [
            'projects' => $this->projectOptions(),
            'templates' => QuestionnaireTemplate::orderBy('name')->get(['id', 'name', 'description', 'questions']),
            'preselect_project_id' => $request->integer('project') ?: null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateQuestionnaire($request);

        $questionnaire = Questionnaire::create([
            'project_id' => $data['project_id'],
            'contact_id' => $this->contactIdForProject($data['project_id']),
            'questionnaire_template_id' => $data['template_id'] ?? null,
            'title' => $data['title'],
            'status' => 'draft',
            'questions' => $this->normaliseQuestions($data['questions'] ?? []),
        ]);

        return redirect()->route('questionnaires.show', $questionnaire)->with('success', 'Questionnaire created.');
    }

    public function show(Questionnaire $questionnaire): Response
    {
        $questionnaire->load(['project:id,name', 'contact:id,first_name,last_name,company,email']);

        return Inertia::render('Questionnaires/Show', [
            'questionnaire' => [
                'id' => $questionnaire->id,
                'title' => $questionnaire->title,
                'status' => $questionnaire->status,
                'questions' => $questionnaire->questions ?? [],
                'answers' => $questionnaire->answers ?? [],
                'project' => $questionnaire->project ? ['id' => $questionnaire->project->id, 'name' => $questionnaire->project->name] : null,
                'contact' => $questionnaire->contact ? ['name' => $questionnaire->contact->name] : null,
                'completed_at' => $questionnaire->completed_at?->toDateString(),
            ],
            'public_url' => route('questionnaires.public.show', $questionnaire->public_id),
            'email_defaults' => ClientEmailContent::defaults($questionnaire),
        ]);
    }

    public function send(Questionnaire $questionnaire): RedirectResponse
    {
        abort_if($questionnaire->status === 'completed', 422);

        $questionnaire->update([
            'status' => 'sent',
            'sent_at' => $questionnaire->sent_at ?? now(),
        ]);

        return back()->with('success', 'Marked as sent. Share the link with your client.');
    }

    public function destroy(Questionnaire $questionnaire): RedirectResponse
    {
        $questionnaire->delete();

        return redirect()->route('questionnaires.index')->with('success', 'Questionnaire deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateQuestionnaire(Request $request): array
    {
        return $request->validate([
            'project_id' => 'required|integer|exists:projects,id',
            'template_id' => 'nullable|integer|exists:questionnaire_templates,id',
            'title' => 'required|string|max:255',
            'questions' => 'array|min:1',
            'questions.*.key' => 'nullable|string|max:60',
            'questions.*.label' => 'required|string|max:255',
            'questions.*.type' => ['required', Rule::in(['text', 'textarea', 'date', 'select', 'checkbox'])],
            'questions.*.options' => 'nullable|array',
            'questions.*.options.*' => 'string|max:255',
            'questions.*.required' => 'boolean',
        ]);
    }

    /**
     * Ensure every question has a stable unique key (derived from its label).
     *
     * @param  array<int, array<string, mixed>>  $questions
     * @return array<int, array<string, mixed>>
     */
    private function normaliseQuestions(array $questions): array
    {
        $seen = [];

        return array_values(array_map(function ($q, $i) use (&$seen) {
            $key = $q['key'] ?? null;
            if (! $key) {
                $key = Str::slug($q['label'], '_') ?: 'q'.($i + 1);
            }
            while (in_array($key, $seen, true)) {
                $key .= '_'.($i + 1);
            }
            $seen[] = $key;

            return [
                'key' => $key,
                'label' => $q['label'],
                'type' => $q['type'],
                'options' => $q['options'] ?? [],
                'required' => (bool) ($q['required'] ?? false),
            ];
        }, $questions, array_keys($questions)));
    }

    private function projectOptions()
    {
        return Project::with('contact:id,first_name,last_name,company')
            ->orderByDesc('event_date')->orderBy('name')
            ->get(['id', 'name', 'contact_id'])
            ->map(fn (Project $p) => [
                'id' => $p->id,
                'name' => $p->contact ? "{$p->name} — {$p->contact->name}" : $p->name,
            ]);
    }

    private function contactIdForProject(int $projectId): ?int
    {
        return Project::whereKey($projectId)->value('contact_id');
    }
}
