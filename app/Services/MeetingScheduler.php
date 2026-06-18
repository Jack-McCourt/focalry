<?php

namespace App\Services;

use App\Models\Meeting;

/**
 * Coordinates the external side-effects of a meeting: creating the video-call
 * link (Zoom when chosen) and syncing the Google Calendar event. Used on
 * confirm / auto-confirm; cancel() tears the same things down.
 */
class MeetingScheduler
{
    public function __construct(
        private ZoomService $zoom,
        private GoogleCalendarService $calendar,
    ) {}

    public function sync(Meeting $meeting): void
    {
        $type = $meeting->meetingType;

        // Generate the Zoom link first so the calendar invite can carry it.
        if ($type?->location_type === 'video' && ($type->video_provider ?? 'google_meet') === 'zoom') {
            $this->zoom->syncMeeting($meeting);
        }

        // Google Meet links (when chosen) are created by the calendar event itself.
        $this->calendar->syncMeeting($meeting);
    }

    public function cancel(Meeting $meeting): void
    {
        $this->zoom->removeMeeting($meeting);
        $this->calendar->removeMeeting($meeting);
    }
}
