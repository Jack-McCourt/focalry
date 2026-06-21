<?php

namespace Tests\Feature\Auth;

use App\Models\Studio;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * The minimum valid registration payload (registration also captures the
     * studio's billing address + country).
     */
    private function registrationData(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'address_line1' => '1 Camera Lane',
            'city' => 'London',
            'postal_code' => 'EC1A 1BB',
            'country' => 'GB',
        ], $overrides);
    }

    public function test_registration_screen_can_be_rendered(): void
    {
        $response = $this->get('/register');

        $response->assertStatus(200);
    }

    public function test_new_users_can_register(): void
    {
        $response = $this->post('/register', $this->registrationData());

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_registration_sends_a_verification_email(): void
    {
        Notification::fake();

        $this->post('/register', $this->registrationData(['email' => 'verify@example.com']));

        $user = User::where('email', 'verify@example.com')->firstOrFail();

        $this->assertNull($user->email_verified_at);
        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_registration_creates_a_studio_for_the_new_user(): void
    {
        $this->post('/register', $this->registrationData(['email' => 'studio@example.com']));

        $user = User::where('email', 'studio@example.com')->first();

        $this->assertNotNull($user);
        $this->assertNotNull($user->studio_id);
        $this->assertSame('owner', $user->role);
        $this->assertNotNull(Studio::find($user->studio_id));
    }
}
