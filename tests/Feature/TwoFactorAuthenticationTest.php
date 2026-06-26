<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PragmaRX\Google2FA\Google2FA;

uses(RefreshDatabase::class);

/** Enable + confirm 2FA for a user, returning the valid OTP generator. */
function enableTwoFactor(User $user): Google2FA
{
    $user->enableTwoFactorAuthentication();
    $user->forceFill(['two_factor_confirmed_at' => now()])->save();

    return new Google2FA;
}

it('lets a user enable then confirm two-factor authentication', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post(route('two-factor.enable'));
    $user->refresh();
    expect($user->hasPendingTwoFactorAuthentication())->toBeTrue()
        ->and($user->hasEnabledTwoFactorAuthentication())->toBeFalse();

    $code = (new Google2FA)->getCurrentOtp($user->two_factor_secret);
    $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => $code]);

    $user->refresh();
    expect($user->hasEnabledTwoFactorAuthentication())->toBeTrue()
        ->and($user->recoveryCodes())->toHaveCount(8);
});

it('rejects an invalid confirmation code', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('two-factor.enable'));

    $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => '000000'])
        ->assertSessionHasErrors('code');

    expect($user->fresh()->hasEnabledTwoFactorAuthentication())->toBeFalse();
});

it('defers login to the challenge when 2FA is enabled', function () {
    $user = User::factory()->create();
    enableTwoFactor($user);

    $response = $this->post('/login', ['email' => $user->email, 'password' => 'password']);

    $response->assertRedirect(route('two-factor.login'));
    $this->assertGuest();
    $response->assertSessionHas('login.id', $user->id);
});

it('completes login with a valid authenticator code', function () {
    $user = User::factory()->create();
    $totp = enableTwoFactor($user);

    $this->post('/login', ['email' => $user->email, 'password' => 'password']);

    $response = $this->post(route('two-factor.login'), [
        'code' => $totp->getCurrentOtp($user->two_factor_secret),
    ]);

    $response->assertRedirect(route('dashboard', absolute: false));
    $this->assertAuthenticatedAs($user);
});

it('completes login with a recovery code and consumes it', function () {
    $user = User::factory()->create();
    enableTwoFactor($user);
    $recovery = $user->recoveryCodes()[0];

    $this->post('/login', ['email' => $user->email, 'password' => 'password']);
    $this->post(route('two-factor.login'), ['recovery_code' => $recovery]);

    $this->assertAuthenticatedAs($user);
    expect($user->fresh()->recoveryCodes())->not->toContain($recovery)->toHaveCount(7);
});

it('rejects an invalid challenge code', function () {
    $user = User::factory()->create();
    enableTwoFactor($user);

    $this->post('/login', ['email' => $user->email, 'password' => 'password']);
    $this->post(route('two-factor.login'), ['code' => '000000'])->assertSessionHasErrors('code');

    $this->assertGuest();
});

it('lets a user disable two-factor authentication', function () {
    $user = User::factory()->create();
    enableTwoFactor($user);

    $this->actingAs($user)->delete(route('two-factor.disable'));

    expect($user->fresh()->hasEnabledTwoFactorAuthentication())->toBeFalse();
});
