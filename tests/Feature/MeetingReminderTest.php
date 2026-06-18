<?php

use App\Mail\MeetingReminder;
use App\Models\Meeting;
use App\Models\MeetingType;
use App\Models\Studio;
use Carbon\Carbon;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    Carbon::setTestNow(Carbon::parse('2026-07-06 09:00:00', 'UTC'));
});

afterEach(function () {
    Carbon::setTestNow();
});

function confirmedMeeting(Carbon $startsAt): Meeting
{
    $studio = Studio::factory()->create(['name' => 'Lens Studio']);
    app()->instance('current.studio.id', $studio->id);
    $type = MeetingType::create([
        'studio_id' => $studio->id, 'name' => 'Discovery Call', 'duration_minutes' => 30,
        'location_type' => 'video', 'video_provider' => 'google_meet', 'buffer_minutes' => 0, 'min_lead_hours' => 0,
    ]);

    return Meeting::create([
        'studio_id' => $studio->id, 'meeting_type_id' => $type->id,
        'client_name' => 'Dana Lee', 'client_email' => 'dana@example.com',
        'starts_at' => $startsAt, 'ends_at' => $startsAt->copy()->addMinutes(30),
        'status' => 'confirmed',
    ]);
}

it('sends the 24-hour reminder once and is idempotent', function () {
    Mail::fake();
    $meeting = confirmedMeeting(Carbon::now()->addHours(24));

    $this->artisan('meetings:send-reminders')->assertSuccessful();
    Mail::assertSent(MeetingReminder::class, 1);
    expect($meeting->refresh()->reminders_sent)->toBe(['h24']);

    $this->artisan('meetings:send-reminders')->assertSuccessful();
    Mail::assertSent(MeetingReminder::class, 1);
});

it('does not send before the reminder window opens', function () {
    Mail::fake();
    $meeting = confirmedMeeting(Carbon::now()->addDays(5));

    $this->artisan('meetings:send-reminders')->assertSuccessful();

    Mail::assertNothingSent();
    expect($meeting->refresh()->reminders_sent)->toBeNull();
});

it('sends the 1-hour reminder as the meeting approaches', function () {
    Mail::fake();
    $meeting = confirmedMeeting(Carbon::now()->addMinutes(30));

    $this->artisan('meetings:send-reminders')->assertSuccessful();

    Mail::assertSent(MeetingReminder::class, 2);
    expect($meeting->refresh()->reminders_sent)->toBe(['h24', 'h1']);
});

it('ignores pending and cancelled meetings', function () {
    Mail::fake();
    $meeting = confirmedMeeting(Carbon::now()->addHours(24));
    $meeting->update(['status' => 'pending']);

    $this->artisan('meetings:send-reminders')->assertSuccessful();

    Mail::assertNothingSent();
});
