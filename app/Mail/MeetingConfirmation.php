<?php

namespace App\Mail;

use App\Models\Meeting;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Sent to both the client and the studio when a meeting is confirmed, carrying
 * the date/time (in the studio's timezone) and the video-call join link.
 */
class MeetingConfirmation extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Meeting $meeting,
        public string $studioName,
        public string $timezone,
        public bool $forStudio = false,
    ) {}

    public function envelope(): Envelope
    {
        $name = $this->meeting->meetingType?->name ?? 'Meeting';

        return new Envelope(
            subject: $this->forStudio
                ? 'New booking: '.$name.' with '.$this->meeting->client_name
                : 'Booking confirmed: '.$name.' with '.$this->studioName,
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.meeting-confirmation',
            with: [
                'meeting' => $this->meeting,
                'studioName' => $this->studioName,
                'timezone' => $this->timezone,
                'forStudio' => $this->forStudio,
                'meetingName' => $this->meeting->meetingType?->name ?? 'Meeting',
            ],
        );
    }
}
