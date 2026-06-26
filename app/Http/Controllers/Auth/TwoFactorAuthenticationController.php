<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TwoFactorAuthenticationController extends Controller
{
    /** Begin enabling 2FA — generates a secret + recovery codes (unconfirmed). */
    public function store(Request $request): RedirectResponse
    {
        $request->user()->enableTwoFactorAuthentication();

        return back()->with('status', 'two-factor-authentication-pending');
    }

    /** Confirm 2FA by verifying the first authenticator code. */
    public function confirm(Request $request): RedirectResponse
    {
        $data = $request->validate(['code' => 'required|string']);

        if (! $request->user()->confirmTwoFactorAuthentication($data['code'])) {
            throw ValidationException::withMessages([
                'code' => __('The provided two-factor authentication code was invalid.'),
            ]);
        }

        return back()->with('status', 'two-factor-authentication-confirmed');
    }

    /** Issue a fresh set of recovery codes. */
    public function recoveryCodes(Request $request): RedirectResponse
    {
        $request->user()->regenerateRecoveryCodes();

        return back()->with('status', 'recovery-codes-generated');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $request->user()->disableTwoFactorAuthentication();

        return back()->with('status', 'two-factor-authentication-disabled');
    }
}
