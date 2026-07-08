<?php

namespace App\Mail;

use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;

class PaymentReminder extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Invoice $invoice,
        public int $amountCents,
        public Carbon $dueDate,
        public int $offsetDays,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Payment reminder — invoice {$this->invoice->number}",
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.payment-reminder',
            with: [
                'invoice' => $this->invoice,
                'studioName' => $this->invoice->studio?->name ?? config('app.name'),
                'logoUrl' => $this->invoice->studio?->logoUrl(),
                'logoHeight' => $this->invoice->studio?->emailLogoHeight(),
                'amount' => number_format($this->amountCents / 100, 2),
                'currency' => strtoupper($this->invoice->currency),
                'dueDate' => $this->dueDate->toFormattedDateString(),
                'offsetDays' => $this->offsetDays,
            ],
        );
    }
}
