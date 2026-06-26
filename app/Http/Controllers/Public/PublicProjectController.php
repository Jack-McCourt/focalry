<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Mail\ProjectShareCode;
use App\Models\ProjectFieldDefinition;
use App\Models\ProjectShare;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PublicProjectController extends Controller
{
    private const VERIFIED_HOURS = 8;

    /**
     * Read-only, printable project details — gated behind an emailed one-time
     * code so a forwarded link can't be opened by anyone but the invitee.
     */
    public function show(Request $request, string $token): Response
    {
        $share = $this->resolve($token);

        if (! $this->isVerified($request, $share)) {
            $studio = $share->project->studio;

            return Inertia::render('Public/ProjectShareVerify', [
                'token' => $token,
                'masked_email' => $this->maskEmail($share->email),
                'sent' => (bool) $request->session()->get('share_code_sent'),
                'studio_name' => $studio?->name,
                'studio_logo' => $studio?->logoUrl(),
            ]);
        }

        $share->forceFill(['last_viewed_at' => now()])->saveQuietly();

        $project = $share->project;
        $studio = $project->studio;

        $fields = ProjectFieldDefinition::withoutGlobalScopes()
            ->where('studio_id', $project->studio_id)
            ->orderBy('position')
            ->get(['key', 'label', 'type', 'options']);

        return Inertia::render('Public/ProjectShare', [
            'project' => [
                'name' => $project->name,
                'event_date' => $project->event_date?->toDateString(),
                'status' => $project->status?->label,
                'type' => $project->type?->label,
                'notes' => $project->notes,
                'custom_fields' => $project->custom_fields ?? [],
                'client' => $project->contact ? [
                    'name' => $project->contact->name,
                    'email' => $project->contact->email,
                    'phone' => $project->contact->phone,
                ] : null,
            ],
            'fields' => $fields,
            'studio_name' => $studio?->name,
            'studio_logo' => $studio?->logoUrl(),
        ]);
    }

    /** Re-send the share's (persistent) access code to the invited address. */
    public function sendCode(string $token): RedirectResponse
    {
        $share = $this->resolve($token);

        $studio = $share->project->studio;
        Mail::to($share->email)->send(new ProjectShareCode(
            studioName: $studio?->name ?? config('app.name'),
            projectName: $share->project->name,
            code: $share->code,
            logoUrl: $studio?->logoUrl(),
        ));

        return back()->with('share_code_sent', true);
    }

    /** Check the code; on success remember this browser session as verified. */
    public function verify(Request $request, string $token): RedirectResponse
    {
        $share = $this->resolve($token);
        $data = $request->validate(['code' => 'required|string']);

        if (! $share->checkCode($data['code'])) {
            throw ValidationException::withMessages(['code' => 'That code is invalid or has expired.']);
        }

        $request->session()->put($this->sessionKey($share), now()->addHours(self::VERIFIED_HOURS)->timestamp);
        $request->session()->forget('share_code_sent');

        return redirect()->route('projects.public.show', $token);
    }

    private function resolve(string $token): ProjectShare
    {
        return ProjectShare::withoutGlobalScopes()
            ->with(['project.contact', 'project.status', 'project.type', 'project.studio'])
            ->where('token', $token)
            ->firstOrFail();
    }

    private function isVerified(Request $request, ProjectShare $share): bool
    {
        $expires = $request->session()->get($this->sessionKey($share));

        return is_int($expires) && $expires > now()->timestamp;
    }

    private function sessionKey(ProjectShare $share): string
    {
        return "share_ok.{$share->id}";
    }

    private function maskEmail(string $email): string
    {
        [$user, $domain] = array_pad(explode('@', $email, 2), 2, '');
        $head = mb_substr($user, 0, 1);
        $masked = $head.str_repeat('•', max(1, mb_strlen($user) - 1));

        return $domain ? "{$masked}@{$domain}" : $masked;
    }
}
