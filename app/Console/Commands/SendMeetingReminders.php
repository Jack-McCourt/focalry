<?php

namespace App\Console\Commands;

use App\Mail\MeetingReminder;
use App\Models\Meeting;
use App\Models\Studio;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendMeetingReminders extends Command
{
    protected $signature = 'meetings:send-reminders';

    protected $description = 'Email clients a reminder before their confirmed meeting.';

    /** Hours before the meeting to send a reminder. */
    private const OFFSETS = [24, 1];

    public function handle(): int
    {
        $now = now();
        $sentCount = 0;

        Meeting::withoutGlobalScopes()
            ->with('meetingType')
            ->where('status', 'confirmed')
            ->where('starts_at', '>', $now)
            ->whereNotNull('client_email')
            ->cursor()
            ->each(function (Meeting $meeting) use ($now, &$sentCount) {
                $sent = $meeting->reminders_sent ?? [];
                $studio = Studio::find($meeting->studio_id);

                foreach (self::OFFSETS as $hours) {
                    $key = "h{$hours}";
                    if (in_array($key, $sent, true)) {
                        continue;
                    }
                    // Fire once we're within the offset window of the meeting.
                    if ($now->lt($meeting->starts_at->copy()->subHours($hours))) {
                        continue;
                    }

                    try {
                        Mail::to($meeting->client_email)->send(new MeetingReminder($meeting, $studio?->name ?: config('app.name')));
                        $sent[] = $key;
                        $meeting->forceFill(['reminders_sent' => $sent])->saveQuietly();
                        $sentCount++;
                    } catch (\Throwable $e) {
                        Log::error('Meeting reminder failed', ['meeting' => $meeting->id, 'error' => $e->getMessage()]);
                    }
                }
            });

        $this->info("Sent {$sentCount} meeting reminder(s).");

        return self::SUCCESS;
    }
}
