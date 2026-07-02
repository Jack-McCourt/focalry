<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Mail\ClientPortalInvite;
use App\Models\ClientPortalAccess;
use App\Models\Collection;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Meeting;
use App\Models\Project;
use App\Models\Proposal;
use App\Models\Questionnaire;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection as SupportCollection;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The client-facing portal: one branded hub where a client sees everything the
 * studio has shared with them — galleries, invoices, contracts, questionnaires,
 * proposals and sessions — grouped by project. Actions (pay / sign / complete /
 * view) deep-link into the existing per-document public pages, so this layer only
 * aggregates and never duplicates those flows.
 *
 * Access mirrors {@see PublicProjectController}: an unguessable token in the link
 * plus a persistent 6-digit code emailed to the contact, remembered per session.
 */
class ClientPortalController extends Controller
{
    private const VERIFIED_HOURS = 8;

    public function show(Request $request, string $token): Response
    {
        $access = $this->resolve($token);
        $contact = $access->contact;
        $studio = $contact->studio;

        if (! $this->isVerified($request, $access)) {
            return Inertia::render('Public/ClientPortalVerify', [
                'token' => $token,
                'masked_email' => $this->maskEmail($contact->email ?? ''),
                'sent' => (bool) $request->session()->get('portal_code_sent'),
                'studio_name' => $studio?->name,
                'studio_logo' => $studio?->logoUrl(),
            ]);
        }

        $access->forceFill(['last_viewed_at' => now()])->saveQuietly();

        return Inertia::render('Public/ClientPortal', [
            'client_name' => $contact->first_name ?: $contact->name,
            'studio_name' => $studio?->name,
            'studio_logo' => $studio?->logoUrl(),
            'projects' => $this->projects($contact->id, $contact->studio_id),
        ]);
    }

    public function sendCode(Request $request, string $token): RedirectResponse
    {
        $access = $this->resolve($token);
        $this->dispatchInvite($access);

        return back()->with('portal_code_sent', true);
    }

    public function verify(Request $request, string $token): RedirectResponse
    {
        $access = $this->resolve($token);
        $data = $request->validate(['code' => 'required|string']);

        if (! $access->checkCode($data['code'])) {
            throw ValidationException::withMessages(['code' => 'That code is invalid or has expired.']);
        }

        $request->session()->put($this->sessionKey($access), now()->addHours(self::VERIFIED_HOURS)->timestamp);
        $request->session()->forget('portal_code_sent');

        return redirect()->route('portal.show', $token);
    }

    /**
     * Email the portal link + code to the contact. Shared with the studio-side
     * "invite" action so the message is identical wherever it's triggered.
     */
    public static function dispatchInvite(ClientPortalAccess $access): void
    {
        $contact = $access->contact;
        if (! $contact->email) {
            return;
        }
        $studio = $contact->studio;

        Mail::to($contact->email)->send(new ClientPortalInvite(
            studioName: $studio?->name ?? config('app.name'),
            clientName: $contact->first_name ?: $contact->name,
            url: $access->url(),
            code: $access->code,
            logoUrl: $studio?->logoUrl(),
        ));
    }

    /**
     * Build the per-project view model. Each project carries its shared
     * documents; items not attached to a project fall into a synthetic bucket so
     * nothing the studio shared goes missing.
     *
     * @return array<int, array<string, mixed>>
     */
    private function projects(int $contactId, int $studioId): array
    {
        $projects = Project::withoutGlobalScopes()
            ->where('studio_id', $studioId)
            ->where('contact_id', $contactId)
            ->with(['status:id,label,color', 'type:id,label,color'])
            ->orderByDesc('event_date')
            ->get();

        $galleries = $this->byProject($this->galleries($contactId, $studioId));
        $invoices = $this->byProject($this->invoices($contactId, $studioId));
        $contracts = $this->byProject($this->contracts($contactId, $studioId));
        $questionnaires = $this->byProject($this->questionnaires($contactId, $studioId));
        $proposals = $this->byProject($this->proposals($contactId, $studioId));
        $meetings = $this->byProject($this->meetings($contactId, $studioId));

        $bucket = fn (?int $key): array => [
            'galleries' => $galleries[$key] ?? [],
            'invoices' => $invoices[$key] ?? [],
            'contracts' => $contracts[$key] ?? [],
            'questionnaires' => $questionnaires[$key] ?? [],
            'proposals' => $proposals[$key] ?? [],
            'meetings' => $meetings[$key] ?? [],
        ];

        $out = $projects->map(fn (Project $p) => [
            'id' => $p->id,
            'name' => $p->name,
            'event_date' => $p->event_date?->toDateString(),
            'status' => $p->status?->label,
            'type' => $p->type?->label,
            'items' => $bucket($p->id),
        ])->all();

        // Anything shared with the client but not tied to a project.
        $loose = $bucket(null);
        if (array_sum(array_map('count', $loose)) > 0) {
            $out[] = [
                'id' => null,
                'name' => 'Other documents',
                'event_date' => null,
                'status' => null,
                'type' => null,
                'items' => $loose,
            ];
        }

        // Drop projects that have nothing shared with the client yet.
        return array_values(array_filter($out, fn ($p) => array_sum(array_map('count', $p['items'])) > 0));
    }

    /**
     * @param  SupportCollection<int, Model>  $items
     * @return array<int|string, array<int, mixed>>
     */
    private function byProject(SupportCollection $items): array
    {
        return $items->groupBy(fn ($i) => $i['project_id'])->map->values()->all();
    }

    private function galleries(int $contactId, int $studioId): SupportCollection
    {
        return Collection::withoutGlobalScopes()
            ->where('studio_id', $studioId)
            ->where('contact_id', $contactId)
            ->where('status', 'published')
            ->orderByDesc('event_date')
            ->get()
            ->map(fn (Collection $c) => [
                'project_id' => $c->project_id,
                'title' => $c->title,
                'event_date' => $c->event_date?->toDateString(),
                'url' => route('gallery.show', $c->slug),
            ]);
    }

    private function invoices(int $contactId, int $studioId): SupportCollection
    {
        return Invoice::withoutGlobalScopes()
            ->where('studio_id', $studioId)
            ->where('contact_id', $contactId)
            ->whereNotIn('status', ['draft', 'void'])
            ->orderByDesc('issue_date')
            ->get()
            ->map(fn (Invoice $i) => [
                'project_id' => $i->project_id,
                'number' => $i->number,
                'status' => $i->status,
                'currency' => $i->currency,
                'total_cents' => (int) $i->total_cents,
                'balance_cents' => $i->balanceCents(),
                'due_date' => $i->due_date?->toDateString(),
                'url' => route('invoices.public.show', $i->public_id),
            ]);
    }

    private function contracts(int $contactId, int $studioId): SupportCollection
    {
        return Contract::withoutGlobalScopes()
            ->where('studio_id', $studioId)
            ->where('contact_id', $contactId)
            ->whereNotIn('status', ['draft'])
            ->latest()
            ->get()
            ->map(fn (Contract $c) => [
                'project_id' => $c->project_id,
                'title' => $c->title,
                'status' => $c->status,
                'signed' => (bool) $c->signed_at,
                'url' => route('contracts.public.show', $c->public_id),
            ]);
    }

    private function questionnaires(int $contactId, int $studioId): SupportCollection
    {
        return Questionnaire::withoutGlobalScopes()
            ->where('studio_id', $studioId)
            ->where('contact_id', $contactId)
            ->whereNotIn('status', ['draft'])
            ->latest()
            ->get()
            ->map(fn (Questionnaire $q) => [
                'project_id' => $q->project_id,
                'title' => $q->title,
                'status' => $q->status,
                'completed' => (bool) $q->completed_at,
                'url' => route('questionnaires.public.show', $q->public_id),
            ]);
    }

    private function proposals(int $contactId, int $studioId): SupportCollection
    {
        return Proposal::withoutGlobalScopes()
            ->where('studio_id', $studioId)
            ->where('contact_id', $contactId)
            ->whereNotIn('status', ['draft'])
            ->latest()
            ->get()
            ->map(fn (Proposal $p) => [
                'project_id' => $p->project_id,
                'title' => $p->title,
                'status' => $p->status,
                'url' => route('proposals.public.show', $p->public_id),
            ]);
    }

    private function meetings(int $contactId, int $studioId): SupportCollection
    {
        return Meeting::withoutGlobalScopes()
            ->where('studio_id', $studioId)
            ->where('contact_id', $contactId)
            ->whereIn('status', Meeting::ACTIVE_STATUSES)
            ->with('meetingType:id,name')
            ->orderBy('starts_at')
            ->get()
            ->map(fn (Meeting $m) => [
                'project_id' => null, // meetings aren't project-scoped
                'title' => $m->meetingType?->name ?? 'Session',
                'status' => $m->status,
                'starts_at' => $m->starts_at?->toIso8601String(),
                'location' => $m->location,
                'meeting_url' => $m->meeting_url,
            ]);
    }

    private function resolve(string $token): ClientPortalAccess
    {
        return ClientPortalAccess::withoutGlobalScopes()
            ->with('contact.studio')
            ->where('token', $token)
            ->firstOrFail();
    }

    private function isVerified(Request $request, ClientPortalAccess $access): bool
    {
        $expires = $request->session()->get($this->sessionKey($access));

        return is_int($expires) && $expires > now()->timestamp;
    }

    private function sessionKey(ClientPortalAccess $access): string
    {
        return "portal_ok.{$access->id}";
    }

    private function maskEmail(string $email): string
    {
        [$user, $domain] = array_pad(explode('@', $email, 2), 2, '');
        $head = mb_substr($user, 0, 1);
        $masked = $head.str_repeat('•', max(1, mb_strlen($user) - 1));

        return $domain ? "{$masked}@{$domain}" : $masked;
    }
}
