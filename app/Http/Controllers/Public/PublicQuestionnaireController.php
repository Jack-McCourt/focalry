<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Questionnaire;
use App\Services\WorkflowEngine;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PublicQuestionnaireController extends Controller
{
    public function show(string $publicId): Response
    {
        $questionnaire = $this->resolve($publicId);
        $studio = $questionnaire->studio;

        return Inertia::render('Public/Questionnaire/Fill', [
            'questionnaire' => [
                'public_id' => $questionnaire->public_id,
                'title' => $questionnaire->title,
                'status' => $questionnaire->status,
                'questions' => $questionnaire->questions ?? [],
                'answers' => $questionnaire->answers ?? [],
                'completed' => $questionnaire->status === 'completed',
            ],
            'studio_name' => $studio?->name,
            'studio_logo' => $studio?->logoUrl(),
        ]);
    }

    public function submit(Request $request, string $publicId, WorkflowEngine $engine): RedirectResponse
    {
        $questionnaire = $this->resolve($publicId);

        abort_if($questionnaire->status === 'completed', 422, 'This questionnaire has already been submitted.');

        $questions = collect($questionnaire->questions ?? []);
        $rules = [];
        foreach ($questions as $q) {
            $field = "answers.{$q['key']}";
            $required = ! empty($q['required']);
            $rules[$field] = match ($q['type']) {
                'checkbox' => 'nullable|boolean',
                default => ($required ? 'required' : 'nullable').'|string|max:5000',
            };
        }

        $data = $request->validate($rules);

        $questionnaire->update([
            'answers' => $data['answers'] ?? [],
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        // Fire any "questionnaire completed" automations for the linked project.
        if ($questionnaire->project) {
            $engine->dispatch('questionnaire_completed', $questionnaire->project);
        }

        return redirect()
            ->route('questionnaires.public.show', $questionnaire->public_id)
            ->with('success', 'Thank you — your answers have been sent.');
    }

    private function resolve(string $publicId): Questionnaire
    {
        return Questionnaire::withoutGlobalScopes()
            ->with(['studio', 'project'])
            ->where('public_id', $publicId)
            ->firstOrFail();
    }
}
