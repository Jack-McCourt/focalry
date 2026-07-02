<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A single, generic studio business notification (invoice paid, contract signed,
 * etc.). Always lands in the in-app bell (database channel); also emails when the
 * recipient's preferences allow it for this type. One class keeps the bell/inbox
 * rendering uniform — the {@see NotificationType} key drives labels + defaults.
 */
class StudioEvent extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $type,
        public string $title,
        public string $message,
        public ?string $url = null,
        public string $actionText = 'View',
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        $channels = ['database'];

        if (method_exists($notifiable, 'wantsEmail') && $notifiable->wantsEmail($this->type)) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => $this->type,
            'title' => $this->title,
            'preview' => $this->message,
            'url' => $this->url,
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject($this->title)
            ->greeting($this->title)
            ->line($this->message);

        if ($this->url) {
            $mail->action($this->actionText, $this->url);
        }

        return $mail;
    }
}
