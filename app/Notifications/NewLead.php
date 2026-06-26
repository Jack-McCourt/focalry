<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * In-app (bell) notification raised when a website contact form is submitted.
 * Database-only — the studio already gets the enquiry by email via
 * PublicSiteController::sendLeadEmails, so we don't double up on mail here.
 */
class NewLead extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $fromName,
        public string $subject,
        public string $preview,
        public string $url,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'lead',
            'title' => "New enquiry from {$this->fromName}",
            'from_name' => $this->fromName,
            'subject' => $this->subject,
            'preview' => $this->preview,
            'url' => $this->url,
        ];
    }
}
