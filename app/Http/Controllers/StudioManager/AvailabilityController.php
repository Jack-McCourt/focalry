<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\AvailabilityBlock;
use App\Models\AvailabilityRule;
use App\Models\Project;
use App\Models\Studio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AvailabilityController extends Controller
{
    public function edit(): Response
    {
        $studio = auth()->user()->studio;

        return Inertia::render('Meetings/Availability', [
            'rules' => AvailabilityRule::orderBy('day_of_week')->orderBy('start_time')
                ->get(['id', 'day_of_week', 'start_time', 'end_time'])
                ->map(fn (AvailabilityRule $r) => [
                    'day_of_week' => $r->day_of_week,
                    // Normalise to HH:MM for the time inputs.
                    'start_time' => substr((string) $r->start_time, 0, 5),
                    'end_time' => substr((string) $r->end_time, 0, 5),
                ]),
            'blocked_dates' => AvailabilityBlock::where('date', '>=', now()->startOfDay())
                ->orderBy('date')->pluck('date')->map(fn ($d) => $d->format('Y-m-d'))->values(),
            'block_project_dates' => (bool) $studio?->block_project_dates,
            'project_dates' => Project::whereNotNull('event_date')
                ->where('event_date', '>=', now()->startOfDay())
                ->orderBy('event_date')->pluck('event_date')->map(fn ($d) => $d->format('Y-m-d'))->unique()->values(),
            'timezone' => $studio?->effectiveTimezone() ?? config('app.timezone'),
            'timezones' => \DateTimeZone::listIdentifiers(),
            'zoom' => [
                'connected' => (bool) $studio?->zoomConnected(),
                'email' => $studio?->zoom_email,
                'configured' => (bool) config('services.zoom.client_id'),
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'rules' => 'present|array',
            'rules.*.day_of_week' => 'required|integer|between:0,6',
            'rules.*.start_time' => 'required|date_format:H:i',
            'rules.*.end_time' => 'required|date_format:H:i',
            'blocked_dates' => 'present|array',
            'blocked_dates.*' => 'date_format:Y-m-d',
            'block_project_dates' => 'boolean',
            'timezone' => ['sometimes', 'required', 'string', Rule::in(\DateTimeZone::listIdentifiers())],
        ]);

        $studioId = app('current.studio.id');

        // Replace the whole weekly schedule in one transaction.
        AvailabilityRule::where('studio_id', $studioId)->delete();

        foreach ($data['rules'] as $rule) {
            if ($rule['end_time'] <= $rule['start_time']) {
                continue; // skip zero/negative-length windows
            }
            AvailabilityRule::create([
                'studio_id' => $studioId,
                'day_of_week' => $rule['day_of_week'],
                'start_time' => $rule['start_time'],
                'end_time' => $rule['end_time'],
            ]);
        }

        // Replace the manually blocked dates.
        AvailabilityBlock::where('studio_id', $studioId)->delete();
        foreach (array_unique($data['blocked_dates']) as $date) {
            AvailabilityBlock::create(['studio_id' => $studioId, 'date' => $date]);
        }

        $studioUpdate = ['block_project_dates' => $request->boolean('block_project_dates')];
        if (isset($data['timezone'])) {
            $studioUpdate['timezone'] = $data['timezone'];
        }
        Studio::whereKey($studioId)->update($studioUpdate);

        return back()->with('success', 'Availability updated.');
    }

    /**
     * Block one or more days immediately, independent of the weekly-hours form
     * so "block this day" takes effect without a separate save.
     */
    public function block(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'dates' => 'required|array|min:1',
            'dates.*' => 'date_format:Y-m-d',
        ]);

        $studioId = app('current.studio.id');

        $existing = AvailabilityBlock::where('studio_id', $studioId)
            ->pluck('date')
            ->map(fn ($d) => $d->format('Y-m-d'))
            ->all();

        foreach (array_diff(array_unique($data['dates']), $existing) as $date) {
            AvailabilityBlock::create(['studio_id' => $studioId, 'date' => $date]);
        }

        return back()->with('success', 'Time off blocked.');
    }

    public function unblock(Request $request): RedirectResponse
    {
        $data = $request->validate(['date' => 'required|date_format:Y-m-d']);

        AvailabilityBlock::where('studio_id', app('current.studio.id'))
            ->whereDate('date', $data['date'])
            ->delete();

        return back()->with('success', 'Time off removed.');
    }
}
