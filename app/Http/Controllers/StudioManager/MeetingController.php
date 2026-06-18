<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Services\GoogleCalendarService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MeetingController extends Controller
{
    public function index(Request $request): Response
    {
        $status = in_array($request->input('status'), ['upcoming', 'pending', 'past', 'all'], true)
            ? $request->input('status')
            : 'upcoming';

        $query = Meeting::query()
            ->with(['meetingType:id,name,color', 'contact:id,first_name,last_name'])
            ->orderBy('starts_at');

        match ($status) {
            'pending' => $query->where('status', 'pending'),
            'upcoming' => $query->whereIn('status', ['pending', 'confirmed'])->where('starts_at', '>=', now()),
            'past' => $query->where('starts_at', '<', now()),
            default => null,
        };

        if ($status === 'past') {
            $query->reorder('starts_at', 'desc');
        }

        return Inertia::render('Meetings/Index', [
            'meetings' => $query->get()->map(fn (Meeting $m) => $this->item($m)),
            'filters' => ['status' => $status],
            'counts' => [
                'pending' => Meeting::where('status', 'pending')->count(),
                'upcoming' => Meeting::whereIn('status', ['pending', 'confirmed'])->where('starts_at', '>=', now())->count(),
            ],
        ]);
    }

    public function confirm(Meeting $meeting, GoogleCalendarService $calendar): RedirectResponse
    {
        $meeting->update(['status' => 'confirmed']);
        $calendar->syncMeeting($meeting);

        return back()->with('success', 'Meeting confirmed.');
    }

    public function decline(Meeting $meeting, GoogleCalendarService $calendar): RedirectResponse
    {
        $meeting->update(['status' => 'declined']);
        $calendar->removeMeeting($meeting);

        return back()->with('success', 'Meeting declined.');
    }

    public function cancel(Meeting $meeting, GoogleCalendarService $calendar): RedirectResponse
    {
        $meeting->update(['status' => 'cancelled']);
        $calendar->removeMeeting($meeting);

        return back()->with('success', 'Meeting cancelled.');
    }

    /** @return array<string, mixed> */
    private function item(Meeting $m): array
    {
        return [
            'id' => $m->id,
            'client_name' => $m->client_name,
            'client_email' => $m->client_email,
            'client_phone' => $m->client_phone,
            'starts_at' => $m->starts_at->toIso8601String(),
            'ends_at' => $m->ends_at->toIso8601String(),
            'status' => $m->status,
            'price_cents' => $m->price_cents,
            'currency' => $m->currency,
            'location' => $m->location,
            'notes' => $m->notes,
            'meeting_url' => $m->meeting_url,
            'meeting_type' => $m->meetingType ? ['name' => $m->meetingType->name, 'color' => $m->meetingType->color] : null,
            'contact_id' => $m->contact_id,
        ];
    }
}
