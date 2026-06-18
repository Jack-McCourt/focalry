<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Contact;
use App\Models\SessionType;
use App\Models\Studio;
use App\Support\BookingSlots;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PublicBookingController extends Controller
{
    /** How far ahead clients can book. */
    private const WINDOW_DAYS = 60;

    public function index(string $slug): Response
    {
        $studio = $this->resolveStudio($slug);

        $types = SessionType::withoutGlobalScopes()
            ->where('studio_id', $studio->id)
            ->where('active', true)
            ->orderBy('name')
            ->get();

        return Inertia::render('Public/Booking/Studio', [
            'studio' => $this->studioPayload($studio),
            'sessionTypes' => $types->map(fn (SessionType $t) => $this->typePayload($t))->values(),
        ]);
    }

    public function show(string $slug, string $type): Response
    {
        $studio = $this->resolveStudio($slug);
        $sessionType = $this->resolveType($studio, $type);

        $from = Carbon::now(config('app.timezone'));
        $to = $from->copy()->addDays(self::WINDOW_DAYS);

        return Inertia::render('Public/Booking/Book', [
            'studio' => $this->studioPayload($studio),
            'sessionType' => $this->typePayload($sessionType),
            'slots' => BookingSlots::forSessionType($sessionType, $from, $to),
        ]);
    }

    public function store(Request $request, string $slug, string $type): RedirectResponse
    {
        $studio = $this->resolveStudio($slug);
        $sessionType = $this->resolveType($studio, $type);

        $data = $request->validate([
            'starts_at' => 'required|date',
            'client_name' => 'required|string|max:255',
            'client_email' => 'required|email|max:255',
            'client_phone' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:5000',
        ]);

        $starts = Carbon::parse($data['starts_at'])->setTimezone(config('app.timezone'));

        // Re-check availability server-side so a stale or tampered slot can't
        // double-book. The submitted start must still be an open slot.
        $open = BookingSlots::forSessionType($sessionType, $starts->copy()->startOfDay(), $starts->copy()->endOfDay());
        $openForDay = $open[$starts->format('Y-m-d')] ?? [];
        $stillOpen = collect($openForDay)->contains(fn ($iso) => Carbon::parse($iso)->equalTo($starts));

        if (! $stillOpen) {
            throw ValidationException::withMessages([
                'starts_at' => 'Sorry, that time was just taken. Please choose another slot.',
            ]);
        }

        $booking = DB::transaction(function () use ($studio, $sessionType, $data, $starts) {
            [$first, $last] = $this->splitName($data['client_name']);

            $contact = Contact::withoutGlobalScopes()
                ->where('studio_id', $studio->id)
                ->where('email', $data['client_email'])
                ->first();

            if (! $contact) {
                $contact = Contact::create([
                    'studio_id' => $studio->id,
                    'first_name' => $first,
                    'last_name' => $last,
                    'email' => $data['client_email'],
                    'phone' => $data['client_phone'] ?? null,
                    'status' => 'lead',
                ]);
            }

            return Booking::create([
                'studio_id' => $studio->id,
                'session_type_id' => $sessionType->id,
                'contact_id' => $contact->id,
                'client_name' => $data['client_name'],
                'client_email' => $data['client_email'],
                'client_phone' => $data['client_phone'] ?? null,
                'starts_at' => $starts,
                'ends_at' => $starts->copy()->addMinutes($sessionType->duration_minutes),
                'status' => $sessionType->manual_approve ? 'pending' : 'confirmed',
                'price_cents' => $sessionType->price_cents,
                'currency' => $sessionType->currency,
                'location' => $sessionType->location,
                'notes' => $data['notes'] ?? null,
            ]);
        });

        return redirect()->route('booking.confirmation', ['booking' => $booking->public_id]);
    }

    public function confirmation(string $booking): Response
    {
        $record = Booking::withoutGlobalScopes()->where('public_id', $booking)->firstOrFail();
        $studio = Studio::findOrFail($record->studio_id);

        return Inertia::render('Public/Booking/Confirmation', [
            'studio' => $this->studioPayload($studio),
            'booking' => [
                'client_name' => $record->client_name,
                'starts_at' => $record->starts_at->toIso8601String(),
                'ends_at' => $record->ends_at->toIso8601String(),
                'status' => $record->status,
                'location' => $record->location,
                'meeting_url' => $record->meeting_url,
                'session_type' => $record->sessionType?->name,
            ],
        ]);
    }

    private function resolveStudio(string $slug): Studio
    {
        return Studio::where('slug', $slug)->firstOrFail();
    }

    private function resolveType(Studio $studio, string $slug): SessionType
    {
        return SessionType::withoutGlobalScopes()
            ->where('studio_id', $studio->id)
            ->where('slug', $slug)
            ->where('active', true)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function studioPayload(Studio $studio): array
    {
        return [
            'name' => $studio->name,
            'slug' => $studio->slug,
            'logo_url' => $studio->logoUrl(),
        ];
    }

    /** @return array<string, mixed> */
    private function typePayload(SessionType $t): array
    {
        return [
            'slug' => $t->slug,
            'name' => $t->name,
            'description' => $t->description,
            'duration_minutes' => $t->duration_minutes,
            'price_cents' => $t->price_cents,
            'currency' => $t->currency,
            'location_type' => $t->location_type,
            'location' => $t->location,
            'color' => $t->color,
        ];
    }

    /** @return array{0: string, 1: string} */
    private function splitName(string $name): array
    {
        $parts = preg_split('/\s+/', trim($name), 2) ?: [];

        return [$parts[0] ?? $name, $parts[1] ?? ''];
    }
}
