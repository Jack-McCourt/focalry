<?php

namespace App\Console\Commands;

use App\Mail\BookingReminder;
use App\Models\Booking;
use App\Models\Studio;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendBookingReminders extends Command
{
    protected $signature = 'bookings:send-reminders';

    protected $description = 'Email clients a reminder before their confirmed booking.';

    /** Hours before the session to send a reminder. */
    private const OFFSETS = [24, 1];

    public function handle(): int
    {
        $now = now();
        $sentCount = 0;

        Booking::withoutGlobalScopes()
            ->with('sessionType')
            ->where('status', 'confirmed')
            ->where('starts_at', '>', $now)
            ->whereNotNull('client_email')
            ->cursor()
            ->each(function (Booking $booking) use ($now, &$sentCount) {
                $sent = $booking->reminders_sent ?? [];
                $studio = Studio::find($booking->studio_id);

                foreach (self::OFFSETS as $hours) {
                    $key = "h{$hours}";
                    if (in_array($key, $sent, true)) {
                        continue;
                    }
                    // Fire once we're within the offset window of the session.
                    if ($now->lt($booking->starts_at->copy()->subHours($hours))) {
                        continue;
                    }

                    try {
                        Mail::to($booking->client_email)->send(new BookingReminder($booking, $studio?->name ?: config('app.name')));
                        $sent[] = $key;
                        $booking->forceFill(['reminders_sent' => $sent])->saveQuietly();
                        $sentCount++;
                    } catch (\Throwable $e) {
                        Log::error('Booking reminder failed', ['booking' => $booking->id, 'error' => $e->getMessage()]);
                    }
                }
            });

        $this->info("Sent {$sentCount} booking reminder(s).");

        return self::SUCCESS;
    }
}
