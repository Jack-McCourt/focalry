<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Studio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Facades\Socialite;

class GoogleCalendarController extends Controller
{
    /** Calendar event management on top of the default identity scopes. */
    private const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

    public function connect(Request $request): RedirectResponse
    {
        // Remember which settings page launched the connect so we can return there.
        session(['gcal_return' => $request->query('from') === 'projects' ? 'projects' : 'meetings']);

        return Socialite::driver('google')
            ->redirectUrl(route('google-calendar.callback'))
            ->scopes(self::SCOPES)
            ->with(['access_type' => 'offline', 'prompt' => 'consent'])
            ->redirect();
    }

    /** Where to send the user after connect/error — back to the originating page. */
    private function returnRoute(): string
    {
        return session()->pull('gcal_return') === 'projects'
            ? route('projects.settings')
            : route('availability.edit');
    }

    public function callback(): RedirectResponse
    {
        try {
            $googleUser = Socialite::driver('google')
                ->redirectUrl(route('google-calendar.callback'))
                ->user();
        } catch (\Throwable $e) {
            Log::warning('Google Calendar connect failed', ['error' => $e->getMessage()]);

            return redirect()->to($this->returnRoute())->with('error', 'Could not connect Google Calendar. Please try again.');
        }

        if (! $googleUser->refreshToken) {
            // Without a refresh token we can't sync long-term; force re-consent.
            return redirect()->to($this->returnRoute())
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

        return redirect()->to($this->returnRoute())->with('success', 'Google Calendar connected.');
    }

    public function disconnect(): RedirectResponse
    {
        $studio = Studio::findOrFail(app('current.studio.id'));
        $studio->update(['google_calendar' => null, 'google_calendar_email' => null]);

        // Return to whichever settings page triggered the disconnect.
        return redirect()->back()->with('success', 'Google Calendar disconnected.');
    }
}
