<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Notifications\NotificationType;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Display the user's profile form.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user();
        $studio = $user->studio;

        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $user instanceof MustVerifyEmail,
            'status' => session('status'),
            'twoFactor' => [
                'enabled' => $user->hasEnabledTwoFactorAuthentication(),
                'pending' => $user->hasPendingTwoFactorAuthentication(),
                // Only expose the secret/QR while setting up, and recovery codes
                // once active — never both, and never on an un-configured account.
                'qrCodeSvg' => $user->hasPendingTwoFactorAuthentication() ? $user->twoFactorQrCodeSvg() : null,
                'secretKey' => $user->hasPendingTwoFactorAuthentication() ? $user->two_factor_secret : null,
                'recoveryCodes' => $user->hasEnabledTwoFactorAuthentication() ? $user->recoveryCodes() : [],
            ],
            'studio' => $studio ? [
                'name' => $studio->name,
                'address_line1' => $studio->address_line1,
                'address_line2' => $studio->address_line2,
                'city' => $studio->city,
                'region' => $studio->region,
                'postal_code' => $studio->postal_code,
                'country' => $studio->country,
                'default_currency' => $studio->default_currency,
                'email_signature' => $studio->email_signature,
                'stripe_connect_status' => $studio->stripe_connect_status,
                'logo_url' => $studio->logoUrl(),
                'email_logo_size' => $studio->logoSize(),
            ] : null,
            'stripe_key' => config('services.stripe.key'),
            'notificationTypes' => collect(NotificationType::TYPES)
                ->map(fn ($t, $key) => [
                    'key' => $key,
                    'label' => $t['label'],
                    'email' => $user->wantsEmail($key),
                ])->values(),
        ]);
    }

    /** Update which notification types email this user (in-app bell is always on). */
    public function updateNotifications(Request $request): RedirectResponse
    {
        $allowed = array_keys(NotificationType::TYPES);
        $data = $request->validate([
            'preferences' => 'array',
            'preferences.*' => 'boolean',
        ]);

        $prefs = collect($data['preferences'] ?? [])
            ->only($allowed)
            ->map(fn ($v) => (bool) $v)
            ->all();

        $request->user()->update(['notification_preferences' => $prefs]);

        return Redirect::route('profile.edit')->with('success', 'Notification preferences saved.');
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        return Redirect::route('profile.edit');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}
