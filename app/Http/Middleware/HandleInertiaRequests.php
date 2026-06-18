<?php

namespace App\Http\Middleware;

use App\Models\Conversation;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                ] : null,
                'studio' => $user ? [
                    'id' => $user->studio_id,
                    'name' => $user->studio->name ?? null,
                    'slug' => $user->studio->slug ?? null,
                    'plan' => $user->studio->plan ?? 'free',
                    'logo_path' => $user->studio->logo_path ?? null,
                ] : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'unread_messages' => fn () => $user ? Conversation::where('unread', true)->count() : 0,
        ];
    }
}
