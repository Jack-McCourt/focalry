<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Studio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Facades\Socialite;

class GoogleCalendarController extends Controller
{
    /** Calendar event management on top of the default identity scopes. */
    private const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

    public function connect(): RedirectResponse
    {
        return Socialite::driver('google')
            ->redirectUrl(route('google-calendar.callback'))
            ->scopes(self::SCOPES)
            ->with(['access_type' => 'offline', 'prompt' => 'consent'])
            ->redirect();
    }

    public function callback(): RedirectResponse
    {
        try {
            $googleUser = Socialite::driver('google')
                ->redirectUrl(route('google-calendar.callback'))
                ->user();
        } catch (\Throwable $e) {
            Log::warning('Google Calendar connect failed', ['error' => $e->getMessage()]);

            return redirect()->route('availability.edit')->with('error', 'Could not connect Google Calendar. Please try again.');
        }

        if (! $googleUser->refreshToken) {
            // Without a refresh token we can't sync long-term; force re-consent.
            return redirect()->route('availability.edit')
                ->with('error', 'Google did not return offline access. Please remove the app under your Google account and reconnect.');
        }

        $studio = Studio::findOrFail(app('current.studio.id'));
        $studio->update([
            'google_calendar' => [
                'access_token' => $googleUser->token,
                'refresh_token' => $googleUser->refreshToken,
                'expires_at' => $googleUser->expiresIn ? now()->addSeconds($googleUser->expiresIn - 30)->toIso8601String() : null,
                'calendar_id' => 'primary',
            ],
            'google_calendar_email' => $googleUser->getEmail(),
        ]);

        return redirect()->route('availability.edit')->with('success', 'Google Calendar connected.');
    }

    public function disconnect(): RedirectResponse
    {
        $studio = Studio::findOrFail(app('current.studio.id'));
        $studio->update(['google_calendar' => null, 'google_calendar_email' => null]);

        return redirect()->route('availability.edit')->with('success', 'Google Calendar disconnected.');
    }
}
