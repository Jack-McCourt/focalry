<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use Illuminate\Queue\SerializesModels;

class StudioMessageMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  array<int, array{path: string, name: string, mime: ?string}>  $files
     */
    public function __construct(
        public string $studioName,
        public string $subjectLine,
        public string $bodyText,
        public string $replyToAddress,
        public string $threadReference,
        public array $files = [],
        public ?string $signature = null,
        public ?string $trackingUrl = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(config('mail.from.address'), $this->studioName),
            replyTo: [new Address($this->replyToAddress)],
            subject: $this->subjectLine,
        );
    }

    public function headers(): Headers
    {
        // A stable References id so the client's email app groups the thread.
        return new Headers(references: [$this->threadReference]);
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.studio-message',
            with: [
                'studioName' => $this->studioName,
                'bodyText' => $this->bodyText,
                'signature' => $this->signature,
                'trackingUrl' => $this->trackingUrl,
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return collect($this->files)
            ->map(fn ($f) => Attachment::fromStorageDisk('public', $f['path'])->as($f['name']))
            ->all();
    }
}
