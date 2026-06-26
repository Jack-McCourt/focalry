<?php

namespace App\Support;

use App\Models\AvailabilityBlock;
use App\Models\AvailabilityRule;
use App\Models\Meeting;
use App\Models\MeetingType;
use App\Models\Project;
use App\Models\Studio;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class MeetingSlots
{
    /**
     * Compute open start times for a meeting type across a date range.
     *
     * Slots respect: the studio's weekly availability windows, the meeting
     * duration, buffer padding around existing meetings, the minimum lead
     * time, and the per-day cap. Returns a map of "Y-m-d" => list of ISO8601
     * start times (carrying the studio timezone's offset).
     *
     * @return array<string, array<int, string>>
     */
    public static function forMeetingType(MeetingType $type, CarbonInterface $from, CarbonInterface $to): array
    {
        // Generate slots in the studio's own timezone so "9am" is 9am local —
        // the ISO strings carry the correct offset for the browser to display.
        $tz = Studio::find($type->studio_id)?->effectiveTimezone() ?? config('app.timezone');
        $now = Carbon::now($tz);
        $earliest = $now->copy()->addHours($type->min_lead_hours);

        // Weekly windows keyed by day-of-week.
        $rules = AvailabilityRule::withoutGlobalScopes()
            ->where('studio_id', $type->studio_id)
            ->get()
            ->groupBy('day_of_week');

        if ($rules->isEmpty()) {
            return [];
        }

        // Whole days that are unavailable: manually blocked, and (optionally)
        // days that already have a project booked on them.
        $blockedDays = self::blockedDays($type->studio_id, $from, $to);

        // Existing active meetings in the range, to subtract from availability.
        $meetings = Meeting::withoutGlobalScopes()
            ->where('studio_id', $type->studio_id)
            ->whereIn('status', Meeting::ACTIVE_STATUSES)
            ->whereBetween('starts_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->get(['meeting_type_id', 'starts_at', 'ends_at']);

        $duration = max(5, $type->duration_minutes);
        $buffer = max(0, $type->buffer_minutes);

        $result = [];
        $cursor = $from->copy()->setTimezone($tz)->startOfDay();
        $end = $to->copy()->setTimezone($tz)->endOfDay();

        while ($cursor->lte($end)) {
            $dow = (int) $cursor->dayOfWeek; // 0 = Sunday
            $windows = $rules->get($dow);

            $dayKey = $cursor->format('Y-m-d');

            if ($windows && ! isset($blockedDays[$dayKey])) {
                $dayMeetings = $meetings->filter(fn (Meeting $m) => $m->starts_at->copy()->setTimezone($tz)->isSameDay($cursor));

                // Per-day cap is counted against this meeting type only.
                if ($type->max_per_day !== null) {
                    $taken = $dayMeetings->where('meeting_type_id', $type->id)->count();
                    if ($taken >= $type->max_per_day) {
                        $cursor->addDay();

                        continue;
                    }
                }

                $slots = self::slotsForDay($cursor, $windows, $duration, $buffer, $earliest, $dayMeetings, $tz);
                if ($slots !== []) {
                    $result[$dayKey] = $slots;
                }
            }

            $cursor->addDay();
        }

        return $result;
    }

    /**
     * Set of "Y-m-d" => true days that are fully unavailable: manually blocked
     * dates, plus (if the studio opts in) days that already have a project.
     *
     * @return array<string, bool>
     */
    private static function blockedDays(int $studioId, CarbonInterface $from, CarbonInterface $to): array
    {
        $blocked = AvailabilityBlock::withoutGlobalScopes()
            ->where('studio_id', $studioId)
            ->whereBetween('date', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->pluck('date')
            ->mapWithKeys(fn ($d) => [Carbon::parse($d)->format('Y-m-d') => true])
            ->all();

        if (Studio::find($studioId)?->block_project_dates) {
            $projectDays = Project::withoutGlobalScopes()
                ->where('studio_id', $studioId)
                ->whereNotNull('event_date')
                ->whereBetween('event_date', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
                ->pluck('event_date')
                ->mapWithKeys(fn ($d) => [Carbon::parse($d)->format('Y-m-d') => true])
                ->all();

            $blocked += $projectDays;
        }

        return $blocked;
    }

    /**
     * @param  Collection<int, AvailabilityRule>  $windows
     * @param  Collection<int, Meeting>  $dayMeetings
     * @return array<int, string>
     */
    private static function slotsForDay(Carbon $day, Collection $windows, int $duration, int $buffer, Carbon $earliest, Collection $dayMeetings, string $tz): array
    {
        $slots = [];

        foreach ($windows as $window) {
            $start = self::atTime($day, (string) $window->start_time, $tz);
            $windowEnd = self::atTime($day, (string) $window->end_time, $tz);

            $candidate = $start->copy();
            while ($candidate->copy()->addMinutes($duration)->lte($windowEnd)) {
                $candidateEnd = $candidate->copy()->addMinutes($duration);

                if ($candidate->gte($earliest) && ! self::conflicts($candidate, $candidateEnd, $buffer, $dayMeetings, $tz)) {
                    $slots[] = $candidate->toIso8601String();
                }

                $candidate->addMinutes($duration);
            }
        }

        sort($slots);

        return array_values(array_unique($slots));
    }

    /** @param  Collection<int, Meeting>  $dayMeetings */
    private static function conflicts(Carbon $start, Carbon $end, int $buffer, Collection $dayMeetings, string $tz): bool
    {
        foreach ($dayMeetings as $m) {
            $mStart = $m->starts_at->copy()->setTimezone($tz)->subMinutes($buffer);
            $mEnd = $m->ends_at->copy()->setTimezone($tz)->addMinutes($buffer);

            if ($start->lt($mEnd) && $end->gt($mStart)) {
                return true;
            }
        }

        return false;
    }

    private static function atTime(Carbon $day, string $time, string $tz): Carbon
    {
        [$h, $m] = array_pad(explode(':', $time), 2, '0');

        return $day->copy()->setTimezone($tz)->setTime((int) $h, (int) $m, 0);
    }
}
