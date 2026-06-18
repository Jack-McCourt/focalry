<?php

use App\Mail\BookingReminder;
use App\Models\Booking;
use App\Models\SessionType;
use App\Models\Studio;
use Carbon\Carbon;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    Carbon::setTestNow(Carbon::parse('2026-07-06 09:00:00', 'UTC'));
});

afterEach(function () {
    Carbon::setTestNow();
});

function confirmedBooking(Carbon $startsAt): Booking
{
    $studio = Studio::factory()->create(['name' => 'Lens Studio']);
    app()->instance('current.studio.id', $studio->id);
    $type = SessionType::create([
        'studio_id' => $studio->id, 'name' => 'Portrait', 'duration_minutes' => 60,
        'price_cents' => 0, 'currency' => 'usd', 'location_type' => 'in_person', 'buffer_minutes' => 0, 'min_lead_hours' => 0,
    ]);

    return Booking::create([
        'studio_id' => $studio->id, 'session_type_id' => $type->id,
        'client_name' => 'Dana Lee', 'client_email' => 'dana@example.com',
        'starts_at' => $startsAt, 'ends_at' => $startsAt->copy()->addHour(),
        'status' => 'confirmed', 'price_cents' => 0, 'currency' => 'usd',
    ]);
}

it('sends the 24-hour reminder once and is idempotent', function () {
    Mail::fake();
    $booking = confirmedBooking(Carbon::now()->addHours(24)); // exactly in the 24h window

    $this->artisan('bookings:send-reminders')->assertSuccessful();
    Mail::assertSent(BookingReminder::class, 1);
    expect($booking->refresh()->reminders_sent)->toBe(['h24']);

    // Re-running does not resend the same reminder.
    $this->artisan('bookings:send-reminders')->assertSuccessful();
    Mail::assertSent(BookingReminder::class, 1);
});

it('does not send before the reminder window opens', function () {
    Mail::fake();
    $booking = confirmedBooking(Carbon::now()->addDays(5)); // far out

    $this->artisan('bookings:send-reminders')->assertSuccessful();

    Mail::assertNothingSent();
    expect($booking->refresh()->reminders_sent)->toBeNull();
});

it('sends the 1-hour reminder as the session approaches', function () {
    Mail::fake();
    $booking = confirmedBooking(Carbon::now()->addMinutes(30)); // inside both windows

    $this->artisan('bookings:send-reminders')->assertSuccessful();

    // Both offsets fire (24h and 1h) since we're within 30 minutes.
    Mail::assertSent(BookingReminder::class, 2);
    expect($booking->refresh()->reminders_sent)->toBe(['h24', 'h1']);
});

it('ignores pending and cancelled bookings', function () {
    Mail::fake();
    $booking = confirmedBooking(Carbon::now()->addHours(24));
    $booking->update(['status' => 'pending']);

    $this->artisan('bookings:send-reminders')->assertSuccessful();

    Mail::assertNothingSent();
});
