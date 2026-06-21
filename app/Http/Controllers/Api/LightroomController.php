<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * JSON API consumed by the Lightroom Classic publish plugin.
 *
 * Auth is via Sanctum personal access tokens: the plugin exchanges the
 * photographer's email + password for a token (login), then sends it as a
 * Bearer token. Uploads themselves reuse the existing presign + photos
 * endpoints, so the plugin only needs login/account/collection helpers here.
 */
class LightroomController extends Controller
{
    /**
     * Exchange email + password for a personal access token. Public + throttled.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'device_name' => 'nullable|string|max:255',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        if (! $user->hasVerifiedEmail()) {
            throw ValidationException::withMessages([
                'email' => ['Please verify your email address before connecting Lightroom.'],
            ]);
        }

        $device = $validated['device_name'] ?? 'Lightroom Classic';
        $token = $user->createToken('lightroom: '.$device)->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => ['name' => $user->name, 'email' => $user->email],
            'studio' => ['id' => $user->studio_id, 'name' => $user->studio->name],
        ]);
    }

    /**
     * Validate the current token and return who/which studio it belongs to.
     */
    public function account(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => ['name' => $user->name, 'email' => $user->email],
            'studio' => ['id' => $user->studio_id, 'name' => $user->studio->name],
        ]);
    }

    /**
     * List the studio's galleries so the plugin can map a published collection
     * to an existing remote gallery. Scoped to the studio by BelongsToStudio.
     */
    public function collections(Request $request): JsonResponse
    {
        $collections = Collection::query()
            ->withCount('photos')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Collection $c) => [
                'id' => $c->id,
                'title' => $c->title,
                'status' => $c->status,
                'photos_count' => $c->photos_count,
            ]);

        return response()->json(['collections' => $collections]);
    }

    /**
     * Create a new gallery (mirrors the web CollectionController: unique slug,
     * draft status, and a default "Highlights" set so photos always land in one).
     */
    public function createCollection(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'event_date' => 'nullable|date',
        ]);

        $collection = Collection::create([
            ...$validated,
            'slug' => $this->uniqueSlug($validated['title']),
            'status' => 'draft',
        ]);

        $collection->sets()->create([
            'name' => 'Highlights',
            'position' => 1,
            'visible' => true,
        ]);

        return response()->json([
            'collection' => [
                'id' => $collection->id,
                'title' => $collection->title,
                'status' => $collection->status,
            ],
        ], 201);
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title);
        $slug = $base.'-'.Str::lower(Str::random(6));

        while (Collection::withoutGlobalScopes()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.Str::lower(Str::random(6));
        }

        return $slug;
    }
}
