<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Studio;
use App\Support\Currencies;
use App\Support\StudioPaths;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class StudioSettingsController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $studio = Studio::findOrFail(app('current.studio.id'));

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'region' => 'nullable|string|max:255',
            'postal_code' => 'nullable|string|max:20',
            'country' => ['nullable', 'string', Rule::in(array_keys(Currencies::COUNTRY_CURRENCY))],
            'default_currency' => ['required', 'string', Rule::in(Currencies::codes())],
            'email_signature' => 'nullable|string|max:5000',
        ]);

        $studio->update($validated);

        return back()->with('success', 'Studio settings updated.');
    }

    public function uploadLogo(Request $request): RedirectResponse
    {
        $request->validate([
            'logo' => 'required|image|mimes:png,jpg,jpeg,webp,svg|max:2048',
        ]);

        $studio = Studio::findOrFail(app('current.studio.id'));

        try {
            // Replace any existing logo.
            if ($studio->logo_path) {
                Storage::disk('wasabi')->delete($studio->logo_path);
            }

            $path = $request->file('logo')->storePublicly(StudioPaths::asset($studio->id), 'wasabi');
            $studio->update(['logo_path' => $path]);
        } catch (\Throwable $e) {
            report($e);

            return back()->with('error', 'Could not save the logo. Please try again.');
        }

        return back()->with('success', 'Logo updated.');
    }

    public function deleteLogo(): RedirectResponse
    {
        $studio = Studio::findOrFail(app('current.studio.id'));

        if ($studio->logo_path) {
            Storage::disk('wasabi')->delete($studio->logo_path);
            $studio->update(['logo_path' => null]);
        }

        return back()->with('success', 'Logo removed.');
    }
}
