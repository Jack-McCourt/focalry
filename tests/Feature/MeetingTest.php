<?php

use App\Models\AvailabilityRule;
use App\Models\Contact;
use App\Models\Meeting;
use App\Models\MeetingType;
use App\Models\Studio;
use App\Models\User;
use App\Support\MeetingSlots;
use Carbon\Carbon;

beforeEach(function () {
    // Freeze to a known Monday morning (UTC) for deterministic slots.
    Carbon::setTestNow(Carbon::parse('2026-07-06 08:00:00', 'UTC'));
});

afterEach(function () {
    Carbon::setTestNow();
});

/** Create a studio + owner and bind it as the current tenant. */
function meetingStudio(): array
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

function makeMeetingType(int $studioId, array $attrs = []): MeetingType
{
    return MeetingType::create(array_merge([
        'studio_id' => $studioId,
        'name' => 'Discovery Call',
        'duration_minutes' => 60,
        'location_type' => 'video',
        'video_provider' => 'google_meet',
        'min_lead_hours' => 0,
        'buffer_minutes' => 0,
    ], $attrs));
}

it('computes open slots from weekly availability', function () {
    [$studio] = meetingStudio();
    weekdayAvailability($studio->id); // Monday 09:00–12:00
    $type = makeMeetingType($studio->id);

    $slots = MeetingSlots::forMeetingType($type, Carbon::now(), Carbon::now()->endOfDay());

    expect($slots['2026-07-06'] ?? [])->toHaveCount(3);
});

it('excludes slots that conflict with an existing meeting', function () {
    [$studio] = meetingStudio();
    weekdayAvailability($studio->id);
    $type = makeMeetingType($studio->id);

    Meeting::create([
        'studio_id' => $studio->id, 'meeting_type_id' => $type->id,
        'client_name' => 'X', 'client_email' => 'x@e.com',
        'starts_at' => Carbon::parse('2026-07-06 10:00', 'UTC'),
        'ends_at' => Carbon::parse('2026-07-06 11:00', 'UTC'),
        'status' => 'confirmed',
    ]);

    $slots = MeetingSlots::forMeetingType($type, Carbon::now(), Carbon::now()->endOfDay());

    expect($slots['2026-07-06'] ?? [])->toEqual(['2026-07-06T09:00:00+00:00', '2026-07-06T11:00:00+00:00']);
});

it('honours the minimum lead time', function () {
    [$studio] = meetingStudio();
    weekdayAvailability($studio->id);
    $type = makeMeetingType($studio->id, ['min_lead_hours' => 48]);

    $slots = MeetingSlots::forMeetingType($type, Carbon::now(), Carbon::now()->endOfDay());

    expect($slots)->toBeEmpty();
});

it('lets a client book an open slot and creates a lead contact', function () {
    [$studio] = meetingStudio();
    weekdayAvailability($studio->id);
    $type = makeMeetingType($studio->id);

    $this->post(route('meetings.public.store', ['slug' => 'lens-studio', 'type' => $type->slug]), [
        'starts_at' => '2026-07-06T10:00:00+00:00',
        'client_name' => 'Dana Lee',
        'client_email' => 'dana@example.com',
    ])->assertRedirect();

    $meeting = Meeting::withoutGlobalScopes()->first();
    expect($meeting)->not->toBeNull()
        ->and($meeting->status)->toBe('confirmed');

    $contact = Contact::withoutGlobalScopes()->where('email', 'dana@example.com')->first();
    expect($contact)->not->toBeNull()
        ->and($contact->status)->toBe('lead')
        ->and($meeting->contact_id)->toBe($contact->id);
});

it('marks meetings pending when the type needs manual approval', function () {
    [$studio] = meetingStudio();
    weekdayAvailability($studio->id);
    $type = makeMeetingType($studio->id, ['manual_approve' => true]);

    $this->post(route('meetings.public.store', ['slug' => 'lens-studio', 'type' => $type->slug]), [
        'starts_at' => '2026-07-06T10:00:00+00:00',
        'client_name' => 'Dana Lee', 'client_email' => 'dana@example.com',
    ])->assertRedirect();

    expect(Meeting::withoutGlobalScopes()->first()->status)->toBe('pending');
});

it('rejects booking a slot that is already taken', function () {
    [$studio] = meetingStudio();
    weekdayAvailability($studio->id);
    $type = makeMeetingType($studio->id);

    Meeting::create([
        'studio_id' => $studio->id, 'meeting_type_id' => $type->id,
        'client_name' => 'X', 'client_email' => 'x@e.com',
        'starts_at' => Carbon::parse('2026-07-06 10:00', 'UTC'),
        'ends_at' => Carbon::parse('2026-07-06 11:00', 'UTC'),
        'status' => 'confirmed',
    ]);

    $this->post(route('meetings.public.store', ['slug' => 'lens-studio', 'type' => $type->slug]), [
        'starts_at' => '2026-07-06T10:00:00+00:00',
        'client_name' => 'Dana Lee', 'client_email' => 'dana@example.com',
    ])->assertSessionHasErrors('starts_at');

    expect(Meeting::withoutGlobalScopes()->count())->toBe(1);
});

it('lets the studio confirm and decline meetings', function () {
    [$studio, $user] = meetingStudio();
    $type = makeMeetingType($studio->id);
    $meeting = Meeting::create([
        'studio_id' => $studio->id, 'meeting_type_id' => $type->id,
        'client_name' => 'X', 'client_email' => 'x@e.com',
        'starts_at' => Carbon::parse('2026-07-10 10:00', 'UTC'),
        'ends_at' => Carbon::parse('2026-07-10 11:00', 'UTC'),
        'status' => 'pending',
    ]);

    $this->actingAs($user)->post(route('meetings.confirm', $meeting))->assertRedirect();
    expect($meeting->refresh()->status)->toBe('confirmed');

    $this->actingAs($user)->post(route('meetings.decline', $meeting))->assertRedirect();
    expect($meeting->refresh()->status)->toBe('declined');
});

it('creates a meeting type with an auto-generated slug', function () {
    [$studio, $user] = meetingStudio();

    $this->actingAs($user)->post(route('meeting-types.store'), [
        'name' => 'Strategy Session',
        'duration_minutes' => 45,
        'location_type' => 'video',
        'video_provider' => 'google_meet',
        'buffer_minutes' => 0,
        'min_lead_hours' => 24,
    ])->assertRedirect()->assertSessionHasNoErrors();

    $type = MeetingType::withoutGlobalScopes()->first();
    expect($type->name)->toBe('Strategy Session')->and($type->slug)->toBe('strategy-session');
});

it('replaces the weekly availability on update', function () {
    [$studio, $user] = meetingStudio();
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
