<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\SocialAccount;
use App\Models\Studio;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class SocialAuthController extends Controller
{
    public function redirect(string $provider)
    {
        abort_unless($provider === 'google', 404);

        return Socialite::driver($provider)->redirect();
    }

    public function callback(string $provider)
    {
        abort_unless($provider === 'google', 404);

        $socialUser = Socialite::driver($provider)->user();

        $account = SocialAccount::query()
            ->where('provider', $provider)
            ->where('provider_id', $socialUser->getId())
            ->with('user')
            ->first();

        if ($account) {
            $account->update([
                'token' => $socialUser->token,
                'refresh_token' => $socialUser->refreshToken,
                'token_expires_at' => $socialUser->expiresIn
                    ? now()->addSeconds($socialUser->expiresIn)
                    : null,
            ]);

            Auth::login($account->user, remember: true);

            return redirect()->intended(route('dashboard'));
        }

        $user = DB::transaction(function () use ($socialUser, $provider) {
            $studio = Studio::create([
                'name' => $socialUser->getName()."'s Studio",
                'slug' => Str::slug($socialUser->getName().'-'.Str::random(6)),
                'email' => $socialUser->getEmail(),
            ]);

            $user = User::create([
                'studio_id' => $studio->id,
                'name' => $socialUser->getName(),
                'email' => $socialUser->getEmail(),
                'email_verified_at' => now(),
                'role' => 'owner',
            ]);

            $user->socialAccounts()->create([
                'provider' => $provider,
                'provider_id' => $socialUser->getId(),
                'token' => $socialUser->token,
                'refresh_token' => $socialUser->refreshToken,
                'token_expires_at' => $socialUser->expiresIn
                    ? now()->addSeconds($socialUser->expiresIn)
                    : null,
            ]);

            return $user;
        });

        Auth::login($user, remember: true);

        return redirect()->intended(route('dashboard'));
    }
}
