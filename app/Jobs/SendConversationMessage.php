<?php

namespace App\Jobs;

use App\Mail\StudioMessageMail;
use App\Models\Message;
use App\Models\Studio;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Throwable;

class SendConversationMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [30, 120, 300];

    public function __construct(public int $messageId) {}

    public function handle(): void
    {
        $message = Message::withoutGlobalScopes()->with('conversation.contact', 'attachments')->find($this->messageId);
        if (! $message || $message->status === 'sent') {
            return;
        }

        $conversation = $message->conversation;
        $to = $conversation?->contact?->email;

        if (! $to) {
            $message->update(['status' => 'failed', 'error' => 'This contact has no email address.']);

            return;
        }

        $studio = Studio::find($conversation->studio_id);
        $studioName = $studio?->name ?: config('app.name');

        // Prefer the token reply-to (routes replies back into the app). Until
        // inbound is configured, fall back to the studio's own email so replies
        // still reach them (just not threaded in the app).
        $replyTo = $conversation->replyToAddress() ?: ($studio?->email ?: config('mail.from.address'));

        $attachments = $message->attachments
            ->map(fn ($a) => ['path' => $a->path, 'name' => $a->name, 'mime' => $a->mime])
            ->all();

        Mail::to($to)->send(new StudioMessageMail(
            studioName: $studioName,
            subjectLine: $conversation->subject,
            bodyText: $message->body,
            replyToAddress: $replyTo,
            threadReference: $conversation->threadReference(),
            files: $attachments,
            signature: $studio?->email_signature,
            trackingUrl: $message->openTrackingUrl(),
            logoUrl: $studio?->logoUrl(),
        ));

        $message->update(['status' => 'sent', 'error' => null]);
    }

    public function failed(Throwable $e): void
    {
        report($e);

        Message::withoutGlobalScopes()
            ->where('id', $this->messageId)
            ->update(['status' => 'failed', 'error' => mb_substr($e->getMessage(), 0, 1000)]);
    }
}
