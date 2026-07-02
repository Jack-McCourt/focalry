<?php

use App\Models\Contact;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Project;
use App\Models\Studio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

function expenseStudio(): array
{
    $studio = Studio::factory()->onPaidPlan()->create(['default_currency' => 'gbp']);
    app()->instance('current.studio.id', $studio->id);
    $user = User::factory()->for($studio)->create();

    return [$studio, $user];
}

it('creates an expense with a private receipt', function () {
    Storage::fake('wasabi');
    [$studio, $user] = expenseStudio();
    $project = Project::create(['studio_id' => $studio->id, 'name' => 'Smith Wedding']);

    $this->actingAs($user)->post(route('expenses.store'), [
        'spent_on' => '2026-06-10',
        'category' => 'Equipment',
        'vendor' => 'Camera Co',
        'description' => 'Lens',
        'amount_cents' => 75000,
        'currency' => 'gbp',
        'project_id' => $project->id,
        'billable' => 1,
        'receipt' => UploadedFile::fake()->image('receipt.jpg'),
    ])->assertRedirect();

    $expense = Expense::first();
    expect($expense->amount_cents)->toBe(75000)
        ->and($expense->billable)->toBeTrue()
        ->and($expense->project_id)->toBe($project->id)
        ->and($expense->receipt_path)->not->toBeNull();

    // Receipt is stored privately (outside the public/ prefix).
    expect($expense->receipt_path)->toStartWith("studios/{$studio->id}/expenses/receipts");
    Storage::disk('wasabi')->assertExists($expense->receipt_path);
});

it('lists expenses with totals and per-category breakdown', function () {
    [$studio, $user] = expenseStudio();
    Expense::create(['studio_id' => $studio->id, 'spent_on' => '2026-06-01', 'category' => 'Equipment', 'amount_cents' => 10000, 'currency' => 'gbp']);
    Expense::create(['studio_id' => $studio->id, 'spent_on' => '2026-06-02', 'category' => 'Equipment', 'amount_cents' => 5000, 'currency' => 'gbp']);
    Expense::create(['studio_id' => $studio->id, 'spent_on' => '2026-06-03', 'category' => 'Travel & mileage', 'amount_cents' => 2000, 'currency' => 'gbp']);

    $this->actingAs($user)->get(route('expenses.index', ['from' => '2026-01-01', 'to' => '2026-12-31']))
        ->assertInertia(fn (AssertableInertia $p) => $p->component('Expenses/Index')
            ->where('total_cents', 17000)
            ->has('expenses.data', 3)
            ->has('byCategory', 2)
            ->where('byCategory.0.label', 'Equipment')
            ->where('byCategory.0.cents', 15000));
});

it('updates and deletes an expense, removing its receipt', function () {
    Storage::fake('wasabi');
    [$studio, $user] = expenseStudio();
    $expense = Expense::create([
        'studio_id' => $studio->id, 'spent_on' => '2026-06-01', 'category' => 'Other',
        'amount_cents' => 1000, 'currency' => 'gbp', 'receipt_path' => "studios/{$studio->id}/expenses/receipts/old.jpg",
    ]);
    Storage::disk('wasabi')->put($expense->receipt_path, 'x');

    $this->actingAs($user)->post(route('expenses.update', $expense->id), [
        'spent_on' => '2026-06-01', 'category' => 'Software & subscriptions', 'amount_cents' => 2500, 'currency' => 'gbp',
    ])->assertRedirect();
    expect($expense->fresh()->category)->toBe('Software & subscriptions')->and($expense->fresh()->amount_cents)->toBe(2500);

    $this->actingAs($user)->delete(route('expenses.destroy', $expense->id))->assertRedirect();
    expect(Expense::count())->toBe(0);
    Storage::disk('wasabi')->assertMissing("studios/{$studio->id}/expenses/receipts/old.jpg");
});

it('feeds profit & loss into the reports', function () {
    [$studio, $user] = expenseStudio();
    $contact = Contact::create(['studio_id' => $studio->id, 'first_name' => 'Holly', 'email' => 'h@example.com']);
    $invoice = Invoice::create(['studio_id' => $studio->id, 'contact_id' => $contact->id, 'number' => 'INV-1', 'status' => 'paid', 'currency' => 'gbp']);
    InvoicePayment::create(['invoice_id' => $invoice->id, 'amount_cents' => 100000, 'method' => 'card', 'paid_on' => Carbon::today()->toDateString()]);

    Expense::create(['studio_id' => $studio->id, 'spent_on' => Carbon::today()->toDateString(), 'category' => 'Equipment', 'amount_cents' => 40000, 'currency' => 'gbp']);

    $this->actingAs($user)->get(route('reports.index'))
        ->assertInertia(fn (AssertableInertia $p) => $p->component('Reports/Index')
            ->where('pnl.revenue_cents', 100000)
            ->where('pnl.expenses_cents', 40000)
            ->where('pnl.profit_cents', 60000)
            ->where('pnl.margin', 60)
            ->has('expensesByCategory', 1));
});

it('exports expenses as CSV', function () {
    [$studio, $user] = expenseStudio();
    Expense::create(['studio_id' => $studio->id, 'spent_on' => '2026-06-01', 'category' => 'Equipment', 'vendor' => 'ACME', 'amount_cents' => 12345, 'currency' => 'gbp']);

    $res = $this->actingAs($user)->get(route('expenses.export', ['from' => '2026-01-01', 'to' => '2026-12-31']));
    $res->assertOk();
    expect($res->streamedContent())->toContain('Date,Category,Vendor,Description,Project,Billable,Amount')
        ->toContain('123.45');
});

it('blocks studios without the studio_manager plan', function () {
    $studio = Studio::factory()->create(['plan' => 'free']);
    app()->instance('current.studio.id', $studio->id);
    $user = User::factory()->for($studio)->create();

    $this->actingAs($user)->get(route('expenses.index'))->assertRedirect();
});
