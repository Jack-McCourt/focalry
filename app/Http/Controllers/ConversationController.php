<?php

namespace App\Http\Controllers;

use App\Jobs\SendConversationMessage;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
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
            'inbound_configured' => (bool) config('services.messaging.inbound_address'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'contact_id' => 'required|integer|exists:contacts,id',
            'subject' => 'required|string|max:255',
            'body' => 'required_without:attachments|nullable|string|max:20000',
            'attachments' => 'nullable|array|max:10',
            'attachments.*' => 'file|max:15360',
        ]);

        $contact = Contact::findOrFail($data['contact_id']);

        $conversation = Conversation::create([
            'contact_id' => $contact->id,
            'subject' => $data['subject'],
            'last_message_at' => now(),
        ]);

        $this->postOutbound($conversation, $data['body'] ?? '', $request->user()?->id, $request->file('attachments', []));

        return redirect()->route('messages.show', $conversation)->with('success', 'Message sent.');
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
            $path = $file->store("studios/{$message->studio_id}/messages/{$message->id}", 'public');
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
            'contact' => $c->contact ? ['id' => $c->contact->id, 'name' => $c->contact->name] : null,
            'preview' => $c->latestMessage ? str($c->latestMessage->body)->limit(80)->value() : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function detail(Conversation $c): array
    {
        return [
            'id' => $c->id,
            'subject' => $c->subject,
            'status' => $c->status,
            'contact' => $c->contact ? [
                'id' => $c->contact->id,
                'name' => $c->contact->name,
                'email' => $c->contact->email,
                'phone' => $c->contact->phone,
            ] : null,
            'messages' => $c->messages->map(fn (Message $m) => [
                'id' => $m->id,
                'direction' => $m->direction,
                'body' => $m->body,
                'author_name' => $m->direction === 'inbound' ? ($m->author_name ?: $m->author_email) : ($m->user?->name ?? 'You'),
                'status' => $m->status,
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
