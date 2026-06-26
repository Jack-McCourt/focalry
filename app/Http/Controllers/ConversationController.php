<?php

namespace App\Http\Controllers;

use App\Jobs\SendConversationMessage;
use App\Models\Collection;
use App\Models\Contact;
use App\Models\Contract;
use App\Models\Conversation;
use App\Models\Invoice;
use App\Models\Message;
use App\Models\MessageTemplate;
use App\Models\Project;
use App\Models\Proposal;
use App\Models\Questionnaire;
use App\Models\Studio;
use App\Support\PublicAsset;
use App\Support\StudioPaths;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Inertia\Inertia;
use Inertia\Response;

class ConversationController extends Controller
{
    public function index(Request $request, ?Conversation $conversation = null): Response
    {
        $search = trim((string) $request->input('search', ''));
        $status = in_array($request->input('status'), ['open', 'archived'], true) ? $request->input('status') : 'open';

        $conversations = Conversation::query()
            ->with(['contact:id,first_name,last_name,company,email', 'latestMessage'])
            ->where('status', $status)
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($w) use ($search) {
                    $w->where('subject', 'like', "%{$search}%")
                        ->orWhereHas('contact', fn ($c) => $c->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%"));
                });
            })
            ->orderByRaw('last_message_at IS NULL, last_message_at DESC')
            ->get()
            ->map(fn (Conversation $c) => $this->listItem($c));

        $selected = null;
        if ($conversation) {
            // Opening a conversation clears its unread flag.
            if ($conversation->unread) {
                $conversation->update(['unread' => false]);
            }
            $conversation->load(['contact:id,first_name,last_name,company,email,phone', 'messages.user:id,name', 'messages.attachments']);
            $selected = $this->detail($conversation);
        }

        return Inertia::render('Messages/Index', [
            'conversations' => $conversations,
            'selected' => $selected,
            'filters' => ['search' => $search, 'status' => $status],
            'counts' => [
                'open' => Conversation::where('status', 'open')->count(),
                'archived' => Conversation::where('status', 'archived')->count(),
                'unread' => Conversation::where('unread', true)->count(),
            ],
            'contacts' => Contact::whereNotNull('email')->orderBy('first_name')->orderBy('last_name')
                ->get(['id', 'first_name', 'last_name', 'company', 'email'])
                ->map(fn (Contact $c) => ['id' => $c->id, 'name' => $c->name, 'email' => $c->email]),
            'templates' => MessageTemplate::orderBy('name')->get(['id', 'name', 'body']),
            'all_tags' => $this->studioTags(),
            'compose_contact_id' => $request->integer('compose') ?: null,
            'inbound_configured' => (bool) config('services.messaging.inbound_address'),
        ]);
    }

    /** Distinct tags used across the studio's conversations, for reuse/autocomplete. */
    private function studioTags(): array
    {
        return Conversation::whereNotNull('tags')
            ->pluck('tags')
            ->flatten()
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    public function note(Request $request, Conversation $conversation): RedirectResponse
    {
        $data = $request->validate(['body' => 'required|string|max:20000']);

        $conversation->messages()->create([
            'studio_id' => $conversation->studio_id,
            'direction' => 'outbound',
            'is_internal' => true,
            'user_id' => $request->user()?->id,
            'body' => $data['body'],
            'status' => 'sent',
        ]);

        return redirect()->route('messages.show', $conversation)->with('success', 'Note added.');
    }

    public function markUnread(Conversation $conversation): RedirectResponse
    {
        $conversation->update(['unread' => true]);

        return redirect()->route('messages.index')->with('success', 'Marked as unread.');
    }

    public function updateTags(Request $request, Conversation $conversation): RedirectResponse
    {
        $data = $request->validate([
            'tags' => 'nullable|array|max:20',
            'tags.*' => 'nullable|string|max:40',
        ]);

        $tags = collect($data['tags'] ?? [])
            ->map(fn ($t) => trim((string) $t))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $conversation->update(['tags' => $tags ?: null]);

        return back()->with('success', 'Labels updated.');
    }

    /**
     * Tag (or untag, with project_id = null) a single message to one of the
     * conversation contact's projects, so it surfaces in that project's drawer.
     */
    public function tagProject(Request $request, Message $message): RedirectResponse
    {
        $data = $request->validate(['project_id' => 'nullable|integer']);

        $projectId = $data['project_id'] ?? null;
        if ($projectId !== null) {
            // The project must belong to this studio and to the same contact as
            // the message's conversation — never tag across clients.
            $contactId = $message->conversation->contact_id;
            $project = Project::where('id', $projectId)
                ->when($contactId, fn ($q) => $q->where('contact_id', $contactId))
                ->firstOrFail();
            $projectId = $project->id;
        }

        $message->update(['project_id' => $projectId]);

        return back()->with('success', $projectId ? 'Message tagged to project.' : 'Message untagged.');
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'contact_id' => 'required|integer|exists:contacts,id',
            'subject' => 'nullable|string|max:255',
            'body' => 'required_without:attachments|nullable|string|max:20000',
            'attachments' => 'nullable|array|max:10',
            'attachments.*' => 'file|max:15360',
        ]);

        $contact = Contact::findOrFail($data['contact_id']);

        // The composer no longer asks for a subject — default it to the studio
        // name so the client still sees a sensible email subject line.
        $subject = trim((string) ($data['subject'] ?? '')) ?: 'Message from '.($request->user()?->studio?->name ?: config('app.name'));

        $conversation = Conversation::create([
            'contact_id' => $contact->id,
            'subject' => $subject,
            'last_message_at' => now(),
        ]);

        $this->postOutbound($conversation, $data['body'] ?? '', $request->user()?->id, $request->file('attachments', []));

        return redirect()->route('messages.show', $conversation)->with('success', 'Message sent.');
    }

    /**
     * Open the message thread for a contact: jump to their most recent
     * conversation if one exists (preferring an open one), otherwise drop into
     * the composer pre-addressed to them.
     */
    public function withContact(Contact $contact): RedirectResponse
    {
        $conversation = Conversation::where('contact_id', $contact->id)
            ->orderByRaw("status = 'open' DESC")
            ->orderByRaw('last_message_at IS NULL, last_message_at DESC')
            ->first();

        return $conversation
            ? redirect()->route('messages.show', $conversation)
            : redirect()->route('messages.index', ['compose' => $contact->id]);
    }

    public function reply(Request $request, Conversation $conversation): RedirectResponse
    {
        $data = $request->validate([
            'body' => 'required_without:attachments|nullable|string|max:20000',
            'attachments' => 'nullable|array|max:10',
            'attachments.*' => 'file|max:15360',
        ]);

        $this->postOutbound($conversation, $data['body'] ?? '', $request->user()?->id, $request->file('attachments', []));
        $conversation->update(['status' => 'open', 'last_message_at' => now()]);

        return redirect()->route('messages.show', $conversation)->with('success', 'Reply sent.');
    }

    public function archive(Conversation $conversation): RedirectResponse
    {
        $conversation->update(['status' => $conversation->status === 'archived' ? 'open' : 'archived']);

        return back()->with('success', $conversation->status === 'archived' ? 'Conversation archived.' : 'Conversation restored.');
    }

    public function destroy(Conversation $conversation): RedirectResponse
    {
        $conversation->delete();

        return redirect()->route('messages.index')->with('success', 'Conversation deleted.');
    }

    /**
     * Documents that can be linked into a message, restricted to the records
     * belonging to this conversation's contact (invoices, contracts, galleries).
     * All queries are studio-scoped via the BelongsToStudio global scope.
     */
    public function linkables(Conversation $conversation): JsonResponse
    {
        $contactId = $conversation->contact_id;
        $items = [];

        if ($contactId) {
            foreach (Invoice::where('contact_id', $contactId)->latest()->limit(50)->get() as $inv) {
                $items[] = [
                    'type' => 'invoice',
                    'label' => $inv->number ? "Invoice {$inv->number}" : "Invoice #{$inv->id}",
                    'meta' => ucfirst((string) $inv->status),
                    'url' => route('invoices.public.show', $inv->public_id),
                ];
            }
            foreach (Contract::where('contact_id', $contactId)->latest()->limit(50)->get() as $c) {
                $items[] = [
                    'type' => 'contract',
                    'label' => $c->title ?: 'Contract',
                    'meta' => ucfirst((string) $c->status),
                    'url' => route('contracts.public.show', $c->public_id),
                ];
            }
            foreach (Collection::where('contact_id', $contactId)->whereNotNull('slug')->latest()->limit(50)->get() as $col) {
                $items[] = [
                    'type' => 'gallery',
                    'label' => $col->name ?: 'Gallery',
                    'meta' => 'Gallery',
                    'url' => route('gallery.show', $col->slug),
                ];
            }
            foreach (Questionnaire::where('contact_id', $contactId)->latest()->limit(50)->get() as $q) {
                $items[] = [
                    'type' => 'questionnaire',
                    'label' => $q->title ?: 'Questionnaire',
                    'meta' => ucfirst((string) $q->status),
                    'url' => route('questionnaires.public.show', $q->public_id),
                ];
            }
            foreach (Proposal::where('contact_id', $contactId)->latest()->limit(50)->get() as $p) {
                $items[] = [
                    'type' => 'proposal',
                    'label' => $p->title ?: 'Proposal',
                    'meta' => ucfirst((string) $p->status),
                    'url' => route('proposals.public.show', $p->public_id),
                ];
            }
        }

        return response()->json(['items' => $items]);
    }

    /**
     * Upload an image to embed inline in a message body. Stored on the public
     * Wasabi prefix and returned as a hosted URL the composer inserts as a
     * Markdown image (![](url)); rendered inline in the thread and the email.
     */
    public function inlineImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'required|image|mimes:jpg,jpeg,png,gif,webp|max:10240',
        ]);

        $studioId = app('current.studio.id');
        $path = $request->file('image')->storePublicly(StudioPaths::asset($studioId, 'messages/inline'), 'wasabi');

        return response()->json(['url' => PublicAsset::url($path)]);
    }

    /**
     * Record an outbound message and queue the email to the contact (Reply-To
     * carries the conversation token). Sending happens on the Horizon queue;
     * the job flips the message to sent/failed.
     */
    /**
     * @param  array<int, UploadedFile>  $files
     */
    private function postOutbound(Conversation $conversation, string $body, ?int $userId, array $files = []): void
    {
        $message = $conversation->messages()->create([
            'studio_id' => $conversation->studio_id,
            'direction' => 'outbound',
            'user_id' => $userId,
            'body' => $body,
            'status' => 'queued',
        ]);

        $this->storeOutboundAttachments($message, $files);

        // Fail fast (before queueing) only on a missing recipient. Sending works
        // without inbound configured — replies just won't route back into the app.
        if (! $conversation->contact?->email) {
            $message->update(['status' => 'failed', 'error' => 'This contact has no email address.']);

            return;
        }

        SendConversationMessage::dispatch($message->id);
    }

    /**
     * @param  array<int, UploadedFile>  $files
     */
    private function storeOutboundAttachments(Message $message, array $files): void
    {
        foreach ($files as $file) {
            if (! $file) {
                continue;
            }
            $path = $file->storePublicly(StudioPaths::asset($message->studio_id, "messages/{$message->id}"), 'wasabi');
            $message->attachments()->create([
                'studio_id' => $message->studio_id,
                'name' => $file->getClientOriginalName(),
                'path' => $path,
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function listItem(Conversation $c): array
    {
        return [
            'id' => $c->id,
            'subject' => $c->subject,
            'unread' => $c->unread,
            'status' => $c->status,
            'last_message_at' => $c->last_message_at?->toIso8601String(),
            'tags' => $c->tags ?? [],
            'contact' => $c->contact ? ['id' => $c->contact->id, 'name' => $c->contact->name] : null,
            'preview' => $c->latestMessage ? str($c->latestMessage->body)->limit(80)->value() : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function detail(Conversation $c): array
    {
        // Projects belonging to this conversation's contact — the only projects a
        // message in this thread may be tagged to.
        $projects = $c->contact_id
            ? Project::where('contact_id', $c->contact_id)->orderByDesc('id')->get(['id', 'name'])
                ->map(fn (Project $p) => ['id' => $p->id, 'name' => $p->name])
            : collect();

        return [
            'id' => $c->id,
            'subject' => $c->subject,
            'status' => $c->status,
            'tags' => $c->tags ?? [],
            'contact' => $c->contact ? [
                'id' => $c->contact->id,
                'name' => $c->contact->name,
                'email' => $c->contact->email,
                'phone' => $c->contact->phone,
            ] : null,
            'projects' => $projects->values(),
            'messages' => $c->messages->map(fn (Message $m) => [
                'id' => $m->id,
                'direction' => $m->direction,
                'is_internal' => $m->is_internal,
                'project_id' => $m->project_id,
                'body' => $m->body,
                'author_name' => $m->direction === 'inbound' ? ($m->author_name ?: $m->author_email) : ($m->user?->name ?? 'You'),
                'status' => $m->status,
                'opened_at' => $m->opened_at?->toIso8601String(),
                'error' => $m->error,
                'created_at' => $m->created_at->toIso8601String(),
                'attachments' => $m->attachments->map(fn ($a) => [
                    'name' => $a->name,
                    'url' => $a->url(),
                    'size' => $a->size,
                ])->values(),
            ]),
        ];
    }
}
