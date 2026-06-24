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
use Illuminate\Support\Str;

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
        public ?string $logoUrl = null,
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
                'logoUrl' => $this->logoUrl,
                'bodyHtml' => $this->renderRich($this->bodyText),
                'signatureHtml' => $this->signature ? $this->renderRich($this->signature) : null,
                'trackingUrl' => $this->trackingUrl,
            ],
        );
    }

    /**
     * Render a Markdown body to HTML: single newlines become <br>, and any inline
     * images get constrained so they don't blow out the email layout.
     */
    private function renderRich(string $text): string
    {
        $html = Str::markdown($text, [
            'html_input' => 'escape',
            'allow_unsafe_links' => false,
            'renderer' => ['soft_break' => "<br>\n"],
        ]);

        return preg_replace('/<img /i', '<img style="max-width:100%;height:auto;border-radius:6px;" ', $html);
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return collect($this->files)
            ->map(fn ($f) => Attachment::fromStorageDisk('wasabi', $f['path'])->as($f['name']))
            ->all();
    }
}
