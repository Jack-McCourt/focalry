<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\AvailabilityRule;
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
            'timezone' => config('app.timezone'),
            'calendar' => [
                'connected' => (bool) $studio?->googleCalendarConnected(),
                'email' => $studio?->google_calendar_email,
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

        return back()->with('success', 'Availability updated.');
    }
}
