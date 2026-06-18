<?php

use App\Models\AvailabilityRule;
use App\Models\Booking;
use App\Models\Contact;
use App\Models\SessionType;
use App\Models\Studio;
use App\Models\User;
use App\Support\BookingSlots;
use Carbon\Carbon;

beforeEach(function () {
    // Freeze to a known Monday morning (UTC) for deterministic slots.
    Carbon::setTestNow(Carbon::parse('2026-07-06 08:00:00', 'UTC'));
});

afterEach(function () {
    Carbon::setTestNow();
});

/** Create a studio + owner and bind it as the current tenant. */
function bookingStudio(): array
{
    $studio = Studio::factory()->create(['slug' => 'lens-studio']);
    $user = User::factory()->for($studio)->create();
    app()->instance('current.studio.id', $studio->id);

    return [$studio, $user];
}

function weekdayAvailability(int $studioId, int $dow = 1, string $start = '09:00', string $end = '12:00'): void
{
    AvailabilityRule::create(['studio_id' => $studioId, 'day_of_week' => $dow, 'start_time' => $start, 'end_time' => $end]);
}

function makeSessionType(int $studioId, array $attrs = []): SessionType
{
    return SessionType::create(array_merge([
        'studio_id' => $studioId,
        'name' => 'Portrait Session',
        'duration_minutes' => 60,
        'price_cents' => 15000,
        'currency' => 'usd',
        'location_type' => 'in_person',
        'min_lead_hours' => 0,
        'buffer_minutes' => 0,
    ], $attrs));
}

it('computes open slots from weekly availability', function () {
    [$studio] = bookingStudio();
    weekdayAvailability($studio->id); // Monday 09:00–12:00
    $type = makeSessionType($studio->id);

    $slots = BookingSlots::forSessionType($type, Carbon::now(), Carbon::now()->endOfDay());

    // 09:00, 10:00, 11:00 (11:00 + 60 = 12:00 fits).
    expect($slots['2026-07-06'] ?? [])->toHaveCount(3);
});

it('excludes slots that conflict with an existing booking', function () {
    [$studio] = bookingStudio();
    weekdayAvailability($studio->id);
    $type = makeSessionType($studio->id); // no buffer

    Booking::create([
        'studio_id' => $studio->id, 'session_type_id' => $type->id,
        'client_name' => 'X', 'client_email' => 'x@e.com',
        'starts_at' => Carbon::parse('2026-07-06 10:00', 'UTC'),
        'ends_at' => Carbon::parse('2026-07-06 11:00', 'UTC'),
        'status' => 'confirmed', 'price_cents' => 0, 'currency' => 'usd',
    ]);

    $slots = BookingSlots::forSessionType($type, Carbon::now(), Carbon::now()->endOfDay());

    // 10:00 taken; 09:00 and 11:00 remain (back-to-back, no buffer).
    expect($slots['2026-07-06'] ?? [])->toEqual(['2026-07-06T09:00:00+00:00', '2026-07-06T11:00:00+00:00']);
});

it('blocks neighbouring slots when a buffer is set', function () {
    [$studio] = bookingStudio();
    weekdayAvailability($studio->id);
    $type = makeSessionType($studio->id, ['buffer_minutes' => 15]);

    Booking::create([
        'studio_id' => $studio->id, 'session_type_id' => $type->id,
        'client_name' => 'X', 'client_email' => 'x@e.com',
        'starts_at' => Carbon::parse('2026-07-06 10:00', 'UTC'),
        'ends_at' => Carbon::parse('2026-07-06 11:00', 'UTC'),
        'status' => 'confirmed', 'price_cents' => 0, 'currency' => 'usd',
    ]);

    // With a 15-min gap required around the booking, neither the 09:00 nor the
    // 11:00 back-to-back slot is bookable.
    $slots = BookingSlots::forSessionType($type, Carbon::now(), Carbon::now()->endOfDay());

    expect($slots['2026-07-06'] ?? [])->toBeEmpty();
});

it('honours the minimum lead time', function () {
    [$studio] = bookingStudio();
    weekdayAvailability($studio->id);
    $type = makeSessionType($studio->id, ['min_lead_hours' => 48]); // pushes past Monday

    $slots = BookingSlots::forSessionType($type, Carbon::now(), Carbon::now()->endOfDay());

    expect($slots)->toBeEmpty();
});

it('lets a client book an open slot and creates a lead contact', function () {
    [$studio] = bookingStudio();
    weekdayAvailability($studio->id);
    $type = makeSessionType($studio->id);

    $this->post(route('booking.store', ['slug' => 'lens-studio', 'type' => $type->slug]), [
        'starts_at' => '2026-07-06T10:00:00+00:00',
        'client_name' => 'Dana Lee',
        'client_email' => 'dana@example.com',
    ])->assertRedirect();

    $booking = Booking::withoutGlobalScopes()->first();
    expect($booking)->not->toBeNull()
        ->and($booking->status)->toBe('confirmed')
        ->and($booking->price_cents)->toBe(15000);

    $contact = Contact::withoutGlobalScopes()->where('email', 'dana@example.com')->first();
    expect($contact)->not->toBeNull()
        ->and($contact->first_name)->toBe('Dana')
        ->and($contact->status)->toBe('lead')
        ->and($booking->contact_id)->toBe($contact->id);
});

it('marks bookings pending when the session needs manual approval', function () {
    [$studio] = bookingStudio();
    weekdayAvailability($studio->id);
    $type = makeSessionType($studio->id, ['manual_approve' => true]);

    $this->post(route('booking.store', ['slug' => 'lens-studio', 'type' => $type->slug]), [
        'starts_at' => '2026-07-06T10:00:00+00:00',
        'client_name' => 'Dana Lee', 'client_email' => 'dana@example.com',
    ])->assertRedirect();

    expect(Booking::withoutGlobalScopes()->first()->status)->toBe('pending');
});

it('rejects booking a slot that is already taken', function () {
    [$studio] = bookingStudio();
    weekdayAvailability($studio->id);
    $type = makeSessionType($studio->id);

    Booking::create([
        'studio_id' => $studio->id, 'session_type_id' => $type->id,
        'client_name' => 'X', 'client_email' => 'x@e.com',
        'starts_at' => Carbon::parse('2026-07-06 10:00', 'UTC'),
        'ends_at' => Carbon::parse('2026-07-06 11:00', 'UTC'),
        'status' => 'confirmed', 'price_cents' => 0, 'currency' => 'usd',
    ]);

    $this->post(route('booking.store', ['slug' => 'lens-studio', 'type' => $type->slug]), [
        'starts_at' => '2026-07-06T10:00:00+00:00',
        'client_name' => 'Dana Lee', 'client_email' => 'dana@example.com',
    ])->assertSessionHasErrors('starts_at');

    expect(Booking::withoutGlobalScopes()->count())->toBe(1);
});

it('lets the studio confirm and decline bookings', function () {
    [$studio, $user] = bookingStudio();
    $type = makeSessionType($studio->id);
    $booking = Booking::create([
        'studio_id' => $studio->id, 'session_type_id' => $type->id,
        'client_name' => 'X', 'client_email' => 'x@e.com',
        'starts_at' => Carbon::parse('2026-07-10 10:00', 'UTC'),
        'ends_at' => Carbon::parse('2026-07-10 11:00', 'UTC'),
        'status' => 'pending', 'price_cents' => 0, 'currency' => 'usd',
    ]);

    $this->actingAs($user)->post(route('bookings.confirm', $booking))->assertRedirect();
    expect($booking->refresh()->status)->toBe('confirmed');

    $this->actingAs($user)->post(route('bookings.decline', $booking))->assertRedirect();
    expect($booking->refresh()->status)->toBe('declined');
});

it('creates a session type with an auto-generated slug', function () {
    [$studio, $user] = bookingStudio();

    $this->actingAs($user)->post(route('session-types.store'), [
        'name' => 'Engagement Session',
        'duration_minutes' => 90,
        'price_cents' => 20000,
        'currency' => 'usd',
        'location_type' => 'in_person',
        'buffer_minutes' => 0,
        'min_lead_hours' => 24,
    ])->assertRedirect()->assertSessionHasNoErrors();

    $type = SessionType::withoutGlobalScopes()->first();
    expect($type->name)->toBe('Engagement Session')->and($type->slug)->toBe('engagement-session');
});

it('replaces the weekly availability on update', function () {
    [$studio, $user] = bookingStudio();
    weekdayAvailability($studio->id, 1, '09:00', '12:00');

    $this->actingAs($user)->patch(route('availability.update'), [
        'rules' => [
            ['day_of_week' => 2, 'start_time' => '10:00', 'end_time' => '16:00'],
            ['day_of_week' => 4, 'start_time' => '10:00', 'end_time' => '14:00'],
        ],
    ])->assertRedirect()->assertSessionHasNoErrors();

    $rules = AvailabilityRule::withoutGlobalScopes()->where('studio_id', $studio->id)->get();
    expect($rules)->toHaveCount(2)
        ->and($rules->pluck('day_of_week')->sort()->values()->all())->toBe([2, 4]);
});
