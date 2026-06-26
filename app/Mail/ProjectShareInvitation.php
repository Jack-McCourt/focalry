<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ProjectShareInvitation extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $studioName,
        public string $projectName,
        public string $url,
        public ?string $logoUrl = null,
        public ?string $inviterName = null,
        public ?string $code = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(config('mail.from.address'), $this->studioName),
            subject: "{$this->studioName} shared “{$this->projectName}” with you",
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.project-share', with: [
            'studioName' => $this->studioName,
            'projectName' => $this->projectName,
            'url' => $this->url,
            'logoUrl' => $this->logoUrl,
            'inviterName' => $this->inviterName,
            'code' => $this->code,
        ]);
    }
}
