<?php

namespace App\Mail;

use App\Models\Meeting;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class MeetingReminder extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Meeting $meeting,
        public string $studioName,
        public ?string $logoUrl = null,
        public ?int $logoHeight = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reminder: '.($this->meeting->meetingType?->name ?? 'your meeting').' with '.$this->studioName,
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.meeting-reminder',
            with: [
                'meeting' => $this->meeting,
                'studioName' => $this->studioName,
                'logoUrl' => $this->logoUrl,
                'logoHeight' => $this->logoHeight,
                'meetingName' => $this->meeting->meetingType?->name ?? 'Meeting',
            ],
        );
    }
}
