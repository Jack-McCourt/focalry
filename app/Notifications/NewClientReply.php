<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NewClientReply extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $conversationId,
        public string $fromName,
        public string $subject,
        public string $preview,
        public string $body = '',
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'from_name' => $this->fromName,
            'subject' => $this->subject,
            'preview' => $this->preview,
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        // Render via a markdown view so the message body keeps its line breaks
        // (the default ->line() helper runs through markdown, which collapses
        // single newlines into spaces — see mail/studio-message for the same
        // soft_break treatment).
        return (new MailMessage)
            ->subject("New reply from {$this->fromName}")
            ->markdown('mail.new-client-reply', [
                'fromName' => $this->fromName,
                'subject' => $this->subject,
                'body' => $this->body !== '' ? $this->body : $this->preview,
                'url' => url('/messages/'.$this->conversationId),
            ]);
    }
}
