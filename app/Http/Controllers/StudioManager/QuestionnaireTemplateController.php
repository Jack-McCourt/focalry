<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\QuestionnaireTemplate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class QuestionnaireTemplateController extends Controller
{
    public function index(): Response
    {
        if (QuestionnaireTemplate::count() === 0) {
            QuestionnaireTemplate::seedDefaults();
        }

        return Inertia::render('Questionnaires/Templates/Index', [
            'templates' => QuestionnaireTemplate::orderBy('name')->get(['id', 'name', 'description', 'questions']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        QuestionnaireTemplate::create($this->validated($request));

        return back()->with('success', 'Template saved.');
    }

    public function update(Request $request, QuestionnaireTemplate $questionnaireTemplate): RedirectResponse
    {
        $questionnaireTemplate->update($this->validated($request));

        return back()->with('success', 'Template updated.');
    }

    public function destroy(QuestionnaireTemplate $questionnaireTemplate): RedirectResponse
    {
        $questionnaireTemplate->delete();

        return back()->with('success', 'Template deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'questions' => 'array|min:1',
            'questions.*.label' => 'required|string|max:255',
            'questions.*.type' => ['required', Rule::in(['text', 'textarea', 'date', 'select', 'checkbox'])],
            'questions.*.options' => 'nullable|array',
            'questions.*.options.*' => 'string|max:255',
            'questions.*.required' => 'boolean',
        ]);

        $seen = [];
        $data['questions'] = array_values(array_map(function ($q, $i) use (&$seen) {
            $key = Str::slug($q['label'], '_') ?: 'q'.($i + 1);
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
        }, $data['questions'], array_keys($data['questions'])));

        return $data;
    }
}
