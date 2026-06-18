<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Meeting;
use App\Models\MeetingType;
use App\Models\Studio;
use App\Services\GoogleCalendarService;
use App\Support\MeetingSlots;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PublicMeetingController extends Controller
{
    /** How far ahead clients can book. */
    private const WINDOW_DAYS = 60;

    public function index(string $slug): Response
    {
        $studio = $this->resolveStudio($slug);

        $types = MeetingType::withoutGlobalScopes()
            ->where('studio_id', $studio->id)
            ->where('active', true)
            ->orderBy('name')
            ->get();

        return Inertia::render('Public/Meeting/Studio', [
            'studio' => $this->studioPayload($studio),
            'meetingTypes' => $types->map(fn (MeetingType $t) => $this->typePayload($t))->values(),
        ]);
    }

    public function show(string $slug, string $type): Response
    {
        $studio = $this->resolveStudio($slug);
        $meetingType = $this->resolveType($studio, $type);

        $from = Carbon::now(config('app.timezone'));
        $to = $from->copy()->addDays(self::WINDOW_DAYS);

        return Inertia::render('Public/Meeting/Book', [
            'studio' => $this->studioPayload($studio),
            'meetingType' => $this->typePayload($meetingType),
            'slots' => MeetingSlots::forMeetingType($meetingType, $from, $to),
        ]);
    }

    public function store(Request $request, string $slug, string $type): RedirectResponse
    {
        $studio = $this->resolveStudio($slug);
        $meetingType = $this->resolveType($studio, $type);

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
        $open = MeetingSlots::forMeetingType($meetingType, $starts->copy()->startOfDay(), $starts->copy()->endOfDay());
        $openForDay = $open[$starts->format('Y-m-d')] ?? [];
        $stillOpen = collect($openForDay)->contains(fn ($iso) => Carbon::parse($iso)->equalTo($starts));

        if (! $stillOpen) {
            throw ValidationException::withMessages([
                'starts_at' => 'Sorry, that time was just taken. Please choose another slot.',
            ]);
        }

        $meeting = DB::transaction(function () use ($studio, $meetingType, $data, $starts) {
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

            return Meeting::create([
                'studio_id' => $studio->id,
                'meeting_type_id' => $meetingType->id,
                'contact_id' => $contact->id,
                'client_name' => $data['client_name'],
                'client_email' => $data['client_email'],
                'client_phone' => $data['client_phone'] ?? null,
                'starts_at' => $starts,
                'ends_at' => $starts->copy()->addMinutes($meetingType->duration_minutes),
                'status' => $meetingType->manual_approve ? 'pending' : 'confirmed',
                'price_cents' => $meetingType->price_cents,
                'currency' => $meetingType->currency,
                'location' => $meetingType->location,
                'notes' => $data['notes'] ?? null,
            ]);
        });

        // Auto-confirmed meetings sync to the studio's calendar immediately
        // (pending ones sync when the studio confirms them).
        if ($meeting->status === 'confirmed') {
            app(GoogleCalendarService::class)->syncMeeting($meeting);
        }

        return redirect()->route('meetings.public.confirmation', ['meeting' => $meeting->public_id]);
    }

    public function confirmation(string $meeting): Response
    {
        $record = Meeting::withoutGlobalScopes()->where('public_id', $meeting)->firstOrFail();
        $studio = Studio::findOrFail($record->studio_id);

        return Inertia::render('Public/Meeting/Confirmation', [
            'studio' => $this->studioPayload($studio),
            'meeting' => [
                'client_name' => $record->client_name,
                'starts_at' => $record->starts_at->toIso8601String(),
                'ends_at' => $record->ends_at->toIso8601String(),
                'status' => $record->status,
                'location' => $record->location,
                'meeting_url' => $record->meeting_url,
                'meeting_type' => $record->meetingType?->name,
            ],
        ]);
    }

    private function resolveStudio(string $slug): Studio
    {
        return Studio::where('slug', $slug)->firstOrFail();
    }

    private function resolveType(Studio $studio, string $slug): MeetingType
    {
        return MeetingType::withoutGlobalScopes()
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
    private function typePayload(MeetingType $t): array
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
            'video_provider' => $t->video_provider,
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
