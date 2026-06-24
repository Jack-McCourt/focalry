<?php

namespace App\Http\Controllers\Auth;

use App\Fulfilment\Prodigi\StoreDefaults;
use App\Http\Controllers\Controller;
use App\Models\Studio;
use App\Models\User;
use App\Support\Currencies;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Auth/Register');
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'company_name' => 'nullable|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:users',
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'address_line1' => 'required|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'city' => 'required|string|max:255',
            'region' => 'nullable|string|max:255',
            'postal_code' => 'required|string|max:20',
            'country' => ['required', 'string', Rule::in(array_keys(Currencies::COUNTRY_CURRENCY))],
        ]);

        $user = DB::transaction(function () use ($request, $validated) {
            $studio = Studio::create([
                // Use the company name when given; otherwise default to the person's name.
                'name' => filled($validated['company_name'] ?? null) ? trim($validated['company_name']) : $request->name."'s Studio",
                'slug' => Str::slug($request->name.'-'.Str::random(6)),
                'email' => $request->email,
                'address_line1' => $validated['address_line1'],
                'address_line2' => $validated['address_line2'] ?? null,
                'city' => $validated['city'],
                'region' => $validated['region'] ?? null,
                'postal_code' => $validated['postal_code'],
                'country' => $validated['country'],
                // Currency is inferred from the country — no picker on sign-up.
                'default_currency' => Currencies::forCountry($validated['country']),
            ]);

            // Seed a ready-to-sell store (default Prodigi lab price sheet + products).
            app(StoreDefaults::class)->seedFor($studio);

            return User::create([
                'studio_id' => $studio->id,
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => 'owner',
            ]);
        });

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
    }
}
