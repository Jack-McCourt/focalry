<?php

namespace Tests\Feature\Auth;

use App\Models\Studio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_screen_can_be_rendered(): void
    {
        $response = $this->get('/register');

        $response->assertStatus(200);
    }

    public function test_new_users_can_register(): void
    {
        $response = $this->post('/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_registration_creates_a_studio_for_the_new_user(): void
    {
        $this->post('/register', [
            'name' => 'Test User',
            'email' => 'studio@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $user = User::where('email', 'studio@example.com')->first();

        $this->assertNotNull($user);
        $this->assertNotNull($user->studio_id);
        $this->assertSame('owner', $user->role);
        $this->assertNotNull(Studio::find($user->studio_id));
    }
}
