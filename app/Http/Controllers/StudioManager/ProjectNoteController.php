<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectNote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectNoteController extends Controller
{
    public function store(Request $request, Project $project): JsonResponse
    {
        $validated = $request->validate(['body' => 'required|string|max:10000']);

        $note = $project->noteEntries()->create(['body' => $validated['body']]);

        return response()->json([
            'note' => [
                'id' => $note->id,
                'body' => $note->body,
                'created_at' => $note->created_at->toIso8601String(),
            ],
        ]);
    }

    public function update(Request $request, ProjectNote $note): JsonResponse
    {
        $validated = $request->validate(['body' => 'required|string|max:10000']);

        $note->update(['body' => $validated['body']]);

        return response()->json([
            'note' => [
                'id' => $note->id,
                'body' => $note->body,
                'created_at' => $note->created_at->toIso8601String(),
            ],
        ]);
    }

    public function destroy(ProjectNote $note): JsonResponse
    {
        $note->delete();

        return response()->json(['ok' => true]);
    }
}
