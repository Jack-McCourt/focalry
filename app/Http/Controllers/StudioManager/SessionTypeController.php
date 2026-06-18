<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\SessionType;
use App\Support\Currencies;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SessionTypeController extends Controller
{
    public function index(): Response
    {
        $studio = auth()->user()->studio;

        return Inertia::render('Bookings/SessionTypes', [
            'sessionTypes' => SessionType::orderBy('name')->withCount('bookings')->get(),
            'default_currency' => $studio?->default_currency ?? 'usd',
            'booking_base_url' => url('/book/'.($studio?->slug ?? '')),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        SessionType::create($this->validated($request));

        return back()->with('success', 'Session type created.');
    }

    public function update(Request $request, SessionType $sessionType): RedirectResponse
    {
        $sessionType->update($this->validated($request));

        return back()->with('success', 'Session type updated.');
    }

    public function destroy(SessionType $sessionType): RedirectResponse
    {
        $sessionType->delete();

        return back()->with('success', 'Session type deleted.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'duration_minutes' => 'required|integer|min:5|max:1440',
            'price_cents' => 'required|integer|min:0',
            'currency' => ['required', 'string', Rule::in(Currencies::codes())],
            'location_type' => ['required', Rule::in(['in_person', 'phone', 'video'])],
            'location' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:20',
            'buffer_minutes' => 'required|integer|min:0|max:480',
            'min_lead_hours' => 'required|integer|min:0|max:8760',
            'max_per_day' => 'nullable|integer|min:1|max:50',
            'manual_approve' => 'boolean',
            'active' => 'boolean',
        ]);
    }
}
