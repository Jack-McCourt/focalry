<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * A plain studio-branded email with an optional call-to-action button.
 * Used by automated workflows (and anywhere a simple, CTA-optional email is needed).
 */
class StudioEmail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $studioName,
        public string $subjectLine,
        public string $bodyText,
        public ?string $ctaLabel = null,
        public ?string $ctaUrl = null,
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
            markdown: 'mail.studio-email',
            with: [
                'studioName' => $this->studioName,
                'bodyText' => $this->bodyText,
                'ctaLabel' => $this->ctaLabel,
                'ctaUrl' => $this->ctaUrl,
            ],
        );
    }
}
