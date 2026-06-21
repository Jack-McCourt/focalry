<?php

use App\Models\Studio;

test('free plan studio has 15% commission', function () {
    $studio = new Studio(['plan' => 'free', 'commission_rate' => 15]);

    expect($studio->effectiveCommissionRate())->toBe(15);
});

test('paid plan studio has 0% commission', function () {
    $studio = new Studio(['plan' => 'plus', 'commission_rate' => 15]);

    expect($studio->effectiveCommissionRate())->toBe(0);
});

test('isOnFreePlan returns true for free plan', function () {
    $studio = new Studio(['plan' => 'free']);

    expect($studio->isOnFreePlan())->toBeTrue();
});

test('isOnFreePlan returns false for paid plans', function () {
    foreach (['lite', 'basic', 'plus', 'ultimate'] as $plan) {
        $studio = new Studio(['plan' => $plan]);
        expect($studio->isOnFreePlan())->toBeFalse();
    }
});
