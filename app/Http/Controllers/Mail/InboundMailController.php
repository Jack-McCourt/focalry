<?php

namespace App\Http\Controllers\Mail;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Notifications\NewClientReply;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class InboundMailController extends Controller
{
    /**
     * Postmark inbound webhook. The +mailbox-hash on the reply address arrives as
     * `MailboxHash` and maps to a conversation's reply_token. Always 200s so
     * Postmark doesn't retry unmatched mail.
     */
    public function handle(Request $request, string $secret): JsonResponse
    {
        $expected = (string) config('services.messaging.inbound_secret');
        abort_unless($expected !== '' && hash_equals($expected, $secret), 404);

        $payload = $request->all();

        $token = $payload['MailboxHash'] ?? null;
        if (! $token) {
            $token = $this->tokenFromRecipients($payload);
        }
        if (! $token) {
            return response()->json(['ignored' => 'no token']);
        }

        $conversation = Conversation::withoutGlobalScopes()->where('reply_token', $token)->first();
        if (! $conversation) {
            return response()->json(['ignored' => 'no conversation']);
        }

        // Loop protection: drop auto-responders, out-of-office, mailing lists and
        // system senders so they don't clutter the thread or bounce back and forth.
        if ($this->isAutoResponder($payload)) {
            return response()->json(['ignored' => 'auto-responder']);
        }

        $messageId = $payload['MessageID'] ?? null;
        if ($messageId && Message::withoutGlobalScopes()->where('email_message_id', $messageId)->exists()) {
            return response()->json(['ok' => 'duplicate']);
        }

        $attachments = is_array($payload['Attachments'] ?? null) ? $payload['Attachments'] : [];
        $body = trim((string) ($payload['StrippedTextReply'] ?? $payload['TextBody'] ?? ''));
        if ($body === '' && empty($attachments)) {
            $body = '(no text content)';
        }

        $from = $payload['FromFull'] ?? [];

        // Bind the conversation's studio so BelongsToStudio scoping/assignment work
        // on this unauthenticated request.
        app()->instance('current.studio.id', $conversation->studio_id);

        $message = $conversation->messages()->create([
            'studio_id' => $conversation->studio_id,
            'direction' => 'inbound',
            'author_name' => $from['Name'] ?? null,
            'author_email' => $from['Email'] ?? ($payload['From'] ?? null),
            'body' => $body,
            'email_message_id' => $messageId,
            'status' => 'received',
        ]);

        $this->storeInboundAttachments($message, $attachments);

        $conversation->update([
            'unread' => true,
            'status' => 'open',
            'last_message_at' => now(),
        ]);

        $this->notifyStudio($conversation, $message);

        return response()->json(['ok' => true]);
    }

    /** Heuristics for auto-generated mail (out-of-office, bounces, lists, no-reply). */
    private function isAutoResponder(array $payload): bool
    {
        $headers = [];
        foreach ($payload['Headers'] ?? [] as $h) {
            if (isset($h['Name'])) {
                $headers[strtolower($h['Name'])] = strtolower((string) ($h['Value'] ?? ''));
            }
        }

        if (isset($headers['auto-submitted']) && $headers['auto-submitted'] !== 'no') {
            return true;
        }
        if (isset($headers['x-auto-response-suppress']) || isset($headers['x-autoreply']) || isset($headers['x-autorespond'])) {
            return true;
        }
        if (isset($headers['list-id']) || isset($headers['list-unsubscribe'])) {
            return true;
        }
        if (isset($headers['precedence']) && in_array($headers['precedence'], ['bulk', 'auto_reply', 'junk', 'list'], true)) {
            return true;
        }

        $from = strtolower((string) ($payload['From'] ?? ($payload['FromFull']['Email'] ?? '')));
        foreach (['mailer-daemon', 'no-reply', 'noreply', 'postmaster', 'do-not-reply', 'donotreply'] as $needle) {
            if ($from !== '' && str_contains($from, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<int, array<string, mixed>>  $attachments
     */
    private function storeInboundAttachments(Message $message, array $attachments): void
    {
        foreach (array_slice($attachments, 0, 15) as $att) {
            $content = $att['Content'] ?? null; // base64
            if (! $content) {
                continue;
            }
            $binary = base64_decode((string) $content, true);
            if ($binary === false || strlen($binary) > 15 * 1024 * 1024) {
                continue; // skip undecodable or > 15MB
            }

            $name = (string) ($att['Name'] ?? 'attachment');
            $safe = Str::random(8).'-'.preg_replace('/[^A-Za-z0-9._-]/', '_', $name);
            $path = "studios/{$message->studio_id}/messages/{$message->id}/{$safe}";

            Storage::disk('public')->put($path, $binary);

            $message->attachments()->create([
                'studio_id' => $message->studio_id,
                'name' => $name,
                'path' => $path,
                'mime' => $att['ContentType'] ?? null,
                'size' => strlen($binary),
            ]);
        }
    }

    private function notifyStudio(Conversation $conversation, Message $message): void
    {
        $users = User::where('studio_id', $conversation->studio_id)->get();
        if ($users->isEmpty()) {
            return;
        }

        $fromName = $message->author_name ?: ($message->author_email ?: 'A client');
        $preview = str($message->body)->limit(140)->value() ?: '(attachment)';

        Notification::send($users, new NewClientReply(
            conversationId: $conversation->id,
            fromName: $fromName,
            subject: $conversation->subject,
            preview: $preview,
        ));
    }

    /** Fallback: pull the +token out of the recipient addresses. */
    private function tokenFromRecipients(array $payload): ?string
    {
        foreach (['OriginalRecipient', 'ToFull', 'CcFull', 'To'] as $key) {
            $value = $payload[$key] ?? null;
            $emails = [];

            if (is_string($value)) {
                $emails[] = $value;
            } elseif (is_array($value)) {
                foreach ($value as $entry) {
                    $emails[] = is_array($entry) ? ($entry['Email'] ?? '') : (string) $entry;
                }
            }

            foreach ($emails as $email) {
                if (preg_match('/\+([a-z0-9]+)@/i', (string) $email, $m)) {
                    return $m[1];
                }
            }
        }

        return null;
    }
}
