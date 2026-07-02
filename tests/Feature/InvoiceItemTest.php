<?php

use App\Models\Invoice;
use App\Models\Project;
use App\Models\Studio;
use App\Models\User;

it('saves an item name and its optional description line', function () {
    $studio = Studio::factory()->onPaidPlan('plus')->create();
    $user = User::factory()->for($studio)->create();
    app()->instance('current.studio.id', $studio->id);

    $project = Project::create(['studio_id' => $studio->id, 'name' => 'Smith Wedding']);

    $this->actingAs($user)->post(route('invoices.store'), [
        'project_id' => $project->id,
        'number' => 'INV-001',
        'items' => [
            ['description' => 'Wedding package', 'details' => "8 hours coverage\n300 edited photos", 'quantity' => 1, 'unit_amount_cents' => 200000],
            ['description' => 'Travel', 'quantity' => 1, 'unit_amount_cents' => 5000],
        ],
    ])->assertRedirect()->assertSessionHasNoErrors();

    $invoice = Invoice::withoutGlobalScopes()->where('number', 'INV-001')->firstOrFail();
    $items = $invoice->items()->orderBy('position')->get();

    expect($items)->toHaveCount(2)
        ->and($items[0]->description)->toBe('Wedding package')
        ->and($items[0]->details)->toBe("8 hours coverage\n300 edited photos")
        ->and($items[1]->details)->toBeNull();
});
