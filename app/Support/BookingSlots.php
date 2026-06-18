<?php

namespace App\Support;

use App\Models\AvailabilityRule;
use App\Models\Booking;
use App\Models\SessionType;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class BookingSlots
{
    /**
     * Compute open start times for a session type across a date range.
     *
     * Slots respect: the studio's weekly availability windows, the session
     * duration, buffer padding around existing bookings, the minimum lead
     * time, and the per-day cap. Returns a map of "Y-m-d" => list of ISO8601
     * start times (in the app timezone).
     *
     * @return array<string, array<int, string>>
     */
    public static function forSessionType(SessionType $type, CarbonInterface $from, CarbonInterface $to): array
    {
        $tz = config('app.timezone');
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

        // Existing active bookings in the range, to subtract from availability.
        $bookings = Booking::withoutGlobalScopes()
            ->where('studio_id', $type->studio_id)
            ->whereIn('status', Booking::ACTIVE_STATUSES)
            ->whereBetween('starts_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->get(['session_type_id', 'starts_at', 'ends_at']);

        $duration = max(5, $type->duration_minutes);
        $buffer = max(0, $type->buffer_minutes);

        $result = [];
        $cursor = $from->copy($tz)->startOfDay();
        $end = $to->copy($tz)->endOfDay();

        while ($cursor->lte($end)) {
            $dow = (int) $cursor->dayOfWeek; // 0 = Sunday
            $windows = $rules->get($dow);

            if ($windows) {
                $dayKey = $cursor->format('Y-m-d');
                $dayBookings = $bookings->filter(fn (Booking $b) => $b->starts_at->copy()->setTimezone($tz)->isSameDay($cursor));

                // Per-day cap is counted against this session type only.
                if ($type->max_per_day !== null) {
                    $taken = $dayBookings->where('session_type_id', $type->id)->count();
                    if ($taken >= $type->max_per_day) {
                        $cursor->addDay();

                        continue;
                    }
                }

                $slots = self::slotsForDay($cursor, $windows, $duration, $buffer, $earliest, $dayBookings, $tz);
                if ($slots !== []) {
                    $result[$dayKey] = $slots;
                }
            }

            $cursor->addDay();
        }

        return $result;
    }

    /**
     * @param  Collection<int, AvailabilityRule>  $windows
     * @param  Collection<int, Booking>  $dayBookings
     * @return array<int, string>
     */
    private static function slotsForDay(Carbon $day, Collection $windows, int $duration, int $buffer, Carbon $earliest, Collection $dayBookings, string $tz): array
    {
        $slots = [];

        foreach ($windows as $window) {
            $start = self::atTime($day, (string) $window->start_time, $tz);
            $windowEnd = self::atTime($day, (string) $window->end_time, $tz);

            $candidate = $start->copy();
            while ($candidate->copy()->addMinutes($duration)->lte($windowEnd)) {
                $candidateEnd = $candidate->copy()->addMinutes($duration);

                if ($candidate->gte($earliest) && ! self::conflicts($candidate, $candidateEnd, $buffer, $dayBookings, $tz)) {
                    $slots[] = $candidate->toIso8601String();
                }

                $candidate->addMinutes($duration);
            }
        }

        sort($slots);

        return array_values(array_unique($slots));
    }

    /** @param  Collection<int, Booking>  $dayBookings */
    private static function conflicts(Carbon $start, Carbon $end, int $buffer, Collection $dayBookings, string $tz): bool
    {
        foreach ($dayBookings as $b) {
            $bStart = $b->starts_at->copy()->setTimezone($tz)->subMinutes($buffer);
            $bEnd = $b->ends_at->copy()->setTimezone($tz)->addMinutes($buffer);

            if ($start->lt($bEnd) && $end->gt($bStart)) {
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
