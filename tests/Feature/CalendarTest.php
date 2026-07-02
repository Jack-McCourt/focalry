<?php

use App\Models\Contact;
use App\Models\Invoice;
use App\Models\Meeting;
use App\Models\MeetingType;
use App\Models\Project;
use App\Models\Studio;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

function calendarStudio(): array
{
    $studio = Studio::factory()->onPaidPlan()->create(['default_currency' => 'gbp', 'timezone' => 'Europe/London']);
    app()->instance('current.studio.id', $studio->id);
    $user = User::factory()->for($studio)->create();

    return [$studio, $user];
}

it('overlays meetings, shoots, payments and tasks on one month', function () {
    [$studio, $user] = calendarStudio();
    $contact = Contact::create(['studio_id' => $studio->id, 'first_name' => 'Holly', 'email' => 'h@example.com']);
    $type = MeetingType::create(['studio_id' => $studio->id, 'name' => 'Consultation', 'slug' => 'consult', 'duration_minutes' => 30]);

    Meeting::create([
        'studio_id' => $studio->id, 'meeting_type_id' => $type->id, 'contact_id' => $contact->id,
        'client_name' => 'Holly', 'client_email' => 'h@example.com',
        'starts_at' => '2026-09-15 10:00:00', 'ends_at' => '2026-09-15 10:30:00', 'status' => 'confirmed',
    ]);
    Project::create(['studio_id' => $studio->id, 'contact_id' => $contact->id, 'name' => 'Holly Wedding', 'event_date' => '2026-09-20']);
    $invoice = Invoice::create([
        'studio_id' => $studio->id, 'contact_id' => $contact->id, 'number' => 'INV-1',
        'status' => 'sent', 'currency' => 'gbp', 'due_date' => '2026-09-25',
    ]);
    $invoice->forceFill(['total_cents' => 50000, 'amount_paid_cents' => 0])->save();
    Task::create(['studio_id' => $studio->id, 'title' => 'Send gallery', 'due_date' => '2026-09-10']);

    $this->actingAs($user)->get(route('calendar.index', ['month' => '2026-09']))
        ->assertInertia(fn (AssertableInertia $p) => $p->component('Calendar/Index')
            ->where('month', '2026-09')
            ->where('prev', '2026-08')
            ->where('next', '2026-10')
            ->has('events', 4)
            // concat order: meetings, shoots, payments, tasks
            ->where('events.0.type', 'meeting')
            // stored UTC 10:00 → displayed in the studio's tz (BST, +1)
            ->where('events.0.time', '11:00am')
            ->where('events.1.type', 'shoot')
            ->where('events.2.type', 'payment')
            ->where('events.3.type', 'task'));
});

it('flags an overdue payment in red', function () {
    [$studio, $user] = calendarStudio();
    $contact = Contact::create(['studio_id' => $studio->id, 'first_name' => 'Late', 'email' => 'l@example.com']);
    $yesterday = Carbon::today()->subDay();
    $invoice = Invoice::create([
        'studio_id' => $studio->id, 'contact_id' => $contact->id, 'number' => 'INV-OD',
        'status' => 'sent', 'currency' => 'gbp', 'due_date' => $yesterday->toDateString(),
    ]);
    $invoice->forceFill(['total_cents' => 20000, 'amount_paid_cents' => 0])->save();

    $this->actingAs($user)->get(route('calendar.index', ['month' => $yesterday->format('Y-m')]))
        ->assertInertia(fn (AssertableInertia $p) => $p->component('Calendar/Index')
            ->where('events.0.type', 'payment')
            ->where('events.0.color', '#ef4444'));
});

it('only shows the current studio events', function () {
    [$studio, $user] = calendarStudio();
    $other = Studio::factory()->create();
    Project::create(['studio_id' => $other->id, 'name' => 'Someone else', 'event_date' => '2026-09-20']);

    $this->actingAs($user)->get(route('calendar.index', ['month' => '2026-09']))
        ->assertInertia(fn (AssertableInertia $p) => $p->component('Calendar/Index')->has('events', 0));
});

it('blocks studios without the studio_manager plan', function () {
    $studio = Studio::factory()->create(['plan' => 'free']);
    app()->instance('current.studio.id', $studio->id);
    $user = User::factory()->for($studio)->create();

    $this->actingAs($user)->get(route('calendar.index'))->assertRedirect();
});
