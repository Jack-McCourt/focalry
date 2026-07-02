<?php

use App\Models\Contact;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Order;
use App\Models\PackageBooking;
use App\Models\Project;
use App\Models\ProjectType;
use App\Models\SiteLead;
use App\Models\Studio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

function reportStudio(): array
{
    $studio = Studio::factory()->onPaidPlan()->create(['default_currency' => 'gbp']);
    app()->instance('current.studio.id', $studio->id);
    $user = User::factory()->for($studio)->create();

    return [$studio, $user];
}

it('aggregates collected revenue across invoices, store and packages', function () {
    [$studio, $user] = reportStudio();

    $type = ProjectType::create(['studio_id' => $studio->id, 'label' => 'Wedding', 'color' => '#f00', 'position' => 1]);
    $contact = Contact::create(['studio_id' => $studio->id, 'first_name' => 'Holly', 'email' => 'h@example.com']);
    $project = Project::create(['studio_id' => $studio->id, 'contact_id' => $contact->id, 'name' => 'Wedding', 'type_id' => $type->id]);

    $invoice = Invoice::create([
        'studio_id' => $studio->id, 'contact_id' => $contact->id, 'project_id' => $project->id,
        'number' => 'INV-1', 'status' => 'paid', 'currency' => 'gbp',
    ]);
    InvoicePayment::create([
        'invoice_id' => $invoice->id, 'amount_cents' => 30000, 'method' => 'card',
        'paid_on' => Carbon::today()->subDays(5)->toDateString(),
    ]);

    Order::create([
        'studio_id' => $studio->id, 'customer_name' => 'Buyer', 'customer_email' => 'b@example.com',
        'status' => 'paid', 'currency' => 'gbp', 'total_cents' => 10000, 'refunded_cents' => 2000,
        'paid_at' => Carbon::today()->subDays(3),
    ]);

    PackageBooking::create([
        'studio_id' => $studio->id, 'client_name' => 'Sam', 'client_email' => 's@example.com',
        'status' => 'paid', 'currency' => 'gbp', 'amount_cents' => 50000,
    ]);

    // A payment outside the window must be excluded.
    InvoicePayment::create([
        'invoice_id' => $invoice->id, 'amount_cents' => 99999, 'method' => 'card',
        'paid_on' => Carbon::today()->subMonths(20)->toDateString(),
    ]);

    $this->actingAs($user)->get(route('reports.index'))
        ->assertInertia(fn (AssertableInertia $p) => $p->component('Reports/Index')
            // 30000 (invoice) + 8000 (order net of refund) + 50000 (package) = 88000
            ->where('kpis.collected_cents', 88000)
            ->where('kpis.order_count', 3)
            ->has('revenueBySource', 3)
            ->has('revenueByType')); // Wedding + Store + Packages
});

it('reports accounts-receivable aging and overdue invoices', function () {
    [$studio, $user] = reportStudio();
    $contact = Contact::create(['studio_id' => $studio->id, 'first_name' => 'Late', 'email' => 'l@example.com']);

    $overdue = Invoice::create([
        'studio_id' => $studio->id, 'contact_id' => $contact->id,
        'number' => 'INV-OD', 'status' => 'sent', 'currency' => 'gbp',
        'due_date' => Carbon::today()->subDays(10)->toDateString(),
    ]);
    $overdue->forceFill(['total_cents' => 20000, 'amount_paid_cents' => 0])->save();

    $this->actingAs($user)->get(route('reports.index'))
        ->assertInertia(fn (AssertableInertia $p) => $p->component('Reports/Index')
            ->where('receivable.outstanding_cents', 20000)
            ->where('receivable.overdue_cents', 20000)
            ->where('receivable.aging.d1_30', 20000)
            ->has('overdue', 1)
            ->where('overdue.0.number', 'INV-OD'));
});

it('reports the lead conversion funnel', function () {
    [$studio, $user] = reportStudio();
    $contact = Contact::create(['studio_id' => $studio->id, 'first_name' => 'Lead', 'email' => 'x@example.com']);
    $project = Project::create(['studio_id' => $studio->id, 'contact_id' => $contact->id, 'name' => 'Booked']);

    SiteLead::create(['studio_id' => $studio->id, 'name' => 'A', 'email' => 'a@example.com', 'project_id' => $project->id]);
    SiteLead::create(['studio_id' => $studio->id, 'name' => 'B', 'email' => 'b@example.com']);

    $this->actingAs($user)->get(route('reports.index'))
        ->assertInertia(fn (AssertableInertia $p) => $p->component('Reports/Index')
            ->where('leads.leads', 2)
            ->where('leads.converted', 1)
            ->where('leads.conversion_rate', 50));
});

it('exports revenue as CSV', function () {
    [$studio, $user] = reportStudio();
    $contact = Contact::create(['studio_id' => $studio->id, 'first_name' => 'Holly', 'email' => 'h@example.com']);
    $invoice = Invoice::create([
        'studio_id' => $studio->id, 'contact_id' => $contact->id,
        'number' => 'INV-1', 'status' => 'paid', 'currency' => 'gbp',
    ]);
    InvoicePayment::create([
        'invoice_id' => $invoice->id, 'amount_cents' => 12345, 'method' => 'card',
        'paid_on' => Carbon::today()->toDateString(),
    ]);

    $res = $this->actingAs($user)->get(route('reports.export.revenue'));
    $res->assertOk();
    expect($res->headers->get('content-type'))->toContain('text/csv');
    expect($res->streamedContent())->toContain('Date,Source,Reference,Client,Type,Amount')
        ->toContain('123.45');
});

it('blocks studios without the studio_manager plan', function () {
    $studio = Studio::factory()->create(['plan' => 'free']);
    app()->instance('current.studio.id', $studio->id);
    $user = User::factory()->for($studio)->create();

    $this->actingAs($user)->get(route('reports.index'))->assertRedirect();
});
