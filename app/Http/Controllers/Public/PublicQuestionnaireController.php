<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Questionnaire;
use App\Services\WorkflowEngine;
use App\Support\PublicAsset;
use App\Support\StudioPaths;
use Illuminate\Http\JsonResponse;
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
                'image', 'file' => ($required ? 'required' : 'nullable').'|array',
                default => ($required ? 'required' : 'nullable').'|string|max:5000',
            };
            if (in_array($q['type'], ['image', 'file'], true)) {
                $rules["{$field}.*.url"] = 'required|string|max:2048';
                $rules["{$field}.*.name"] = 'nullable|string|max:255';
                $rules["{$field}.*.size"] = 'nullable|integer';
            }
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

    /**
     * Upload an image for an "image" question. Resolved by the unguessable
     * public_id (no auth); stored on the questionnaire's studio public prefix.
     */
    public function uploadImage(Request $request, string $publicId): JsonResponse
    {
        $questionnaire = $this->resolve($publicId);
        abort_if($questionnaire->status === 'completed', 422, 'This questionnaire has already been submitted.');

        $request->validate([
            'image' => 'required|image|mimes:jpg,jpeg,png,gif,webp|max:15360',
        ]);

        $path = $request->file('image')->storePublicly(StudioPaths::asset($questionnaire->studio_id, 'questionnaires/images'), 'wasabi');

        return response()->json([
            'url' => PublicAsset::url($path),
            'name' => $request->file('image')->getClientOriginalName(),
        ]);
    }

    /**
     * Upload a document for a "file" question. Resolved by the unguessable
     * public_id (no auth); stored on the questionnaire's studio public prefix.
     */
    public function uploadFile(Request $request, string $publicId): JsonResponse
    {
        $questionnaire = $this->resolve($publicId);
        abort_if($questionnaire->status === 'completed', 422, 'This questionnaire has already been submitted.');

        $request->validate([
            'file' => 'required|file|max:25600',
        ]);

        $file = $request->file('file');
        $path = $file->storePublicly(StudioPaths::asset($questionnaire->studio_id, 'questionnaires/files'), 'wasabi');

        return response()->json([
            'url' => PublicAsset::url($path),
            'name' => $file->getClientOriginalName(),
            'size' => $file->getSize(),
        ]);
    }

    private function resolve(string $publicId): Questionnaire
    {
        return Questionnaire::withoutGlobalScopes()
            ->with(['studio', 'project'])
            ->where('public_id', $publicId)
            ->firstOrFail();
    }
}
