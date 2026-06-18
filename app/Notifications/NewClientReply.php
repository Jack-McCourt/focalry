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
        return (new MailMessage)
            ->subject("New reply from {$this->fromName}")
            ->greeting("New message from {$this->fromName}")
            ->line("Re: {$this->subject}")
            ->line("\u{201C}{$this->preview}\u{201D}")
            ->action('View conversation', url('/messages/'.$this->conversationId))
            ->line('Reply right here in your studio messages.');
    }
}
