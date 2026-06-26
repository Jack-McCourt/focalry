<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class TwoFactorChallengeController extends Controller
{
    /** Show the 2FA challenge after a password login when the user has 2FA on. */
    public function create(Request $request): Response|RedirectResponse
    {
        if (! $request->session()->has('login.id')) {
            return redirect()->route('login');
        }

        return Inertia::render('Auth/TwoFactorChallenge');
    }

    /** Verify an authenticator code or a recovery code, then complete the login. */
    public function store(Request $request): RedirectResponse
    {
        $userId = $request->session()->get('login.id');
        $user = $userId ? User::find($userId) : null;

        if (! $user || ! $user->hasEnabledTwoFactorAuthentication()) {
            return redirect()->route('login');
        }

        $request->validate([
            'code' => 'nullable|string',
            'recovery_code' => 'nullable|string',
        ]);

        $passed = $request->filled('recovery_code')
            ? $user->useRecoveryCode((string) $request->input('recovery_code'))
            : ($request->filled('code') && $user->verifyTwoFactorCode((string) $request->input('code')));

        if (! $passed) {
            throw ValidationException::withMessages([
                'code' => __('The provided two-factor authentication code was invalid.'),
            ]);
        }

        $remember = (bool) $request->session()->pull('login.remember', false);
        $request->session()->forget(['login.id', 'login.remember']);

        Auth::login($user, $remember);
        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }
}
