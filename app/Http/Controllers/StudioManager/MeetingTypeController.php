<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\MeetingType;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class MeetingTypeController extends Controller
{
    public function index(): Response
    {
        $studio = auth()->user()->studio;

        return Inertia::render('Meetings/MeetingTypes', [
            'meetingTypes' => MeetingType::orderBy('name')->withCount('meetings')->get(),
            'booking_base_url' => url('/book/'.($studio?->slug ?? '')),
            'calendar_connected' => (bool) $studio?->googleCalendarConnected(),
            'zoom_connected' => (bool) $studio?->zoomConnected(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        MeetingType::create($this->validated($request));

        return back()->with('success', 'Meeting type created.');
    }

    public function update(Request $request, MeetingType $meetingType): RedirectResponse
    {
        $meetingType->update($this->validated($request));

        return back()->with('success', 'Meeting type updated.');
    }

    public function destroy(MeetingType $meetingType): RedirectResponse
    {
        $meetingType->delete();

        return back()->with('success', 'Meeting type deleted.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'duration_minutes' => 'required|integer|min:5|max:1440',
            'location_type' => ['required', Rule::in(['video', 'phone', 'in_person'])],
            'location' => 'nullable|string|max:255',
            'video_provider' => ['required', Rule::in(['google_meet', 'zoom'])],
            'color' => 'nullable|string|max:20',
            'buffer_minutes' => 'required|integer|min:0|max:480',
            'min_lead_hours' => 'required|integer|min:0|max:8760',
            'max_per_day' => 'nullable|integer|min:1|max:50',
            'manual_approve' => 'boolean',
            'active' => 'boolean',
        ]);
    }
}
