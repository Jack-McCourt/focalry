<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ClientMessage extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  array<int, array{label: string, value: string}>  $details
     */
    public function __construct(
        public string $studioName,
        public string $subjectLine,
        public string $bodyText,
        public string $ctaLabel,
        public string $ctaUrl,
        public array $details = [],
        public ?string $replyToEmail = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->subjectLine,
            replyTo: $this->replyToEmail ? [$this->replyToEmail] : [],
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.client-message',
            with: [
                'studioName' => $this->studioName,
                'bodyText' => $this->bodyText,
                'ctaLabel' => $this->ctaLabel,
                'ctaUrl' => $this->ctaUrl,
                'details' => $this->details,
            ],
        );
    }
}
