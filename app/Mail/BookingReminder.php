<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingReminder extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Booking $booking,
        public string $studioName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reminder: '.($this->booking->sessionType?->name ?? 'your session').' with '.$this->studioName,
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.booking-reminder',
            with: [
                'booking' => $this->booking,
                'studioName' => $this->studioName,
                'sessionName' => $this->booking->sessionType?->name ?? 'Session',
            ],
        );
    }
}
