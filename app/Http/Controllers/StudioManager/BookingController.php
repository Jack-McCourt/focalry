<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Services\GoogleCalendarService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BookingController extends Controller
{
    public function index(Request $request): Response
    {
        $status = in_array($request->input('status'), ['upcoming', 'pending', 'past', 'all'], true)
            ? $request->input('status')
            : 'upcoming';

        $query = Booking::query()
            ->with(['sessionType:id,name,color', 'contact:id,first_name,last_name'])
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

        return Inertia::render('Bookings/Index', [
            'bookings' => $query->get()->map(fn (Booking $b) => $this->item($b)),
            'filters' => ['status' => $status],
            'counts' => [
                'pending' => Booking::where('status', 'pending')->count(),
                'upcoming' => Booking::whereIn('status', ['pending', 'confirmed'])->where('starts_at', '>=', now())->count(),
            ],
        ]);
    }

    public function confirm(Booking $booking, GoogleCalendarService $calendar): RedirectResponse
    {
        $booking->update(['status' => 'confirmed']);
        $calendar->syncBooking($booking);

        return back()->with('success', 'Booking confirmed.');
    }

    public function decline(Booking $booking, GoogleCalendarService $calendar): RedirectResponse
    {
        $booking->update(['status' => 'declined']);
        $calendar->removeBooking($booking);

        return back()->with('success', 'Booking declined.');
    }

    public function cancel(Booking $booking, GoogleCalendarService $calendar): RedirectResponse
    {
        $booking->update(['status' => 'cancelled']);
        $calendar->removeBooking($booking);

        return back()->with('success', 'Booking cancelled.');
    }

    /** @return array<string, mixed> */
    private function item(Booking $b): array
    {
        return [
            'id' => $b->id,
            'client_name' => $b->client_name,
            'client_email' => $b->client_email,
            'client_phone' => $b->client_phone,
            'starts_at' => $b->starts_at->toIso8601String(),
            'ends_at' => $b->ends_at->toIso8601String(),
            'status' => $b->status,
            'price_cents' => $b->price_cents,
            'currency' => $b->currency,
            'location' => $b->location,
            'notes' => $b->notes,
            'meeting_url' => $b->meeting_url,
            'session_type' => $b->sessionType ? ['name' => $b->sessionType->name, 'color' => $b->sessionType->color] : null,
            'contact_id' => $b->contact_id,
        ];
    }
}
