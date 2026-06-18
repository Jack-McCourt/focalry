<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\AvailabilityBlock;
use App\Models\AvailabilityRule;
use App\Models\Project;
use App\Models\Studio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
            'timezone' => config('app.timezone'),
            'calendar' => [
                'connected' => (bool) $studio?->googleCalendarConnected(),
                'email' => $studio?->google_calendar_email,
            ],
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

        Studio::whereKey($studioId)->update(['block_project_dates' => $request->boolean('block_project_dates')]);

        return back()->with('success', 'Availability updated.');
    }
}
