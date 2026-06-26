<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Mail\ProjectShareInvitation;
use App\Models\Project;
use App\Models\ProjectShare;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ProjectShareController extends Controller
{
    /** Invite someone by email to view the project's read-only share page. */
    public function store(Request $request, Project $project): JsonResponse
    {
        $data = $request->validate(['email' => 'required|email']);
        $email = mb_strtolower(trim($data['email']));

        $share = ProjectShare::firstOrCreate(
            ['project_id' => $project->id, 'email' => $email],
            ['studio_id' => $project->studio_id],
        );

        $studio = $project->studio;
        Mail::to($share->email)->send(new ProjectShareInvitation(
            studioName: $studio?->name ?? config('app.name'),
            projectName: $project->name,
            url: $share->url(),
            logoUrl: $studio?->logoUrl(),
            inviterName: $request->user()?->name,
            code: $share->code,
        ));

        return response()->json(['share' => $this->present($share)]);
    }

    /** Revoke an invitation. The token link stops working immediately. */
    public function destroy(ProjectShare $share): JsonResponse
    {
        $share->delete();

        return response()->json(['ok' => true]);
    }

    /** @return array<string, mixed> */
    private function present(ProjectShare $share): array
    {
        return [
            'id' => $share->id,
            'email' => $share->email,
            'code' => $share->code,
            'last_viewed_at' => $share->last_viewed_at?->toIso8601String(),
            'url' => $share->url(),
        ];
    }
}
