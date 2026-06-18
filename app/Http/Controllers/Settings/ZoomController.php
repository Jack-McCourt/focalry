<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Studio;
use App\Services\ZoomService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ZoomController extends Controller
{
    public function connect(): RedirectResponse
    {
        $query = http_build_query([
            'response_type' => 'code',
            'client_id' => config('services.zoom.client_id'),
            'redirect_uri' => route('zoom.callback'),
        ]);

        return redirect()->away('https://zoom.us/oauth/authorize?'.$query);
    }

    public function callback(Request $request, ZoomService $zoom): RedirectResponse
    {
        $code = (string) $request->query('code');
        if ($code === '') {
            return redirect()->route('availability.edit')->with('error', 'Zoom connection was cancelled.');
        }

        $bundle = $zoom->exchangeCode($code, route('zoom.callback'));
        if (! $bundle || empty($bundle['refresh_token'])) {
            return redirect()->route('availability.edit')->with('error', 'Could not connect Zoom. Please try again.');
        }

        $studio = Studio::findOrFail(app('current.studio.id'));
        $studio->update([
            'zoom' => $bundle,
            'zoom_email' => $zoom->accountEmail($bundle['access_token']),
        ]);

        return redirect()->route('availability.edit')->with('success', 'Zoom connected.');
    }

    public function disconnect(): RedirectResponse
    {
        $studio = Studio::findOrFail(app('current.studio.id'));
        $studio->update(['zoom' => null, 'zoom_email' => null]);

        return redirect()->route('availability.edit')->with('success', 'Zoom disconnected.');
    }
}
