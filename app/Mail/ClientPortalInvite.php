<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ClientPortalInvite extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $studioName,
        public string $clientName,
        public string $url,
        public string $code,
        public ?string $logoUrl = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(config('mail.from.address'), $this->studioName),
            subject: "Your client portal with {$this->studioName}",
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.client-portal-invite', with: [
            'studioName' => $this->studioName,
            'clientName' => $this->clientName,
            'url' => $this->url,
            'code' => $this->code,
            'logoUrl' => $this->logoUrl,
        ]);
    }
}
