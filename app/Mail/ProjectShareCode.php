<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ProjectShareCode extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $studioName,
        public string $projectName,
        public string $code,
        public ?string $logoUrl = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(config('mail.from.address'), $this->studioName),
            subject: "Your access code: {$this->code}",
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.project-share-code', with: [
            'studioName' => $this->studioName,
            'projectName' => $this->projectName,
            'code' => $this->code,
            'logoUrl' => $this->logoUrl,
        ]);
    }
}
