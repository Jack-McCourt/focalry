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
                    'is_super_admin' => $user->isSuperAdmin(),
                ] : null,
                'studio' => $user ? [
                    'id' => $user->studio_id,
                    'name' => $user->studio->name ?? null,
                    'slug' => $user->studio->slug ?? null,
                    'plan' => $user->studio->planKey() ?? 'free',
                    'logo_path' => $user->studio->logo_path ?? null,
                    'features' => $user->studio->planConfig()['features'] ?? [],
                    'storage_used' => (int) ($user->studio->storage_used ?? 0),
                    'storage_limit' => $user->studio->storageLimit(),
                ] : null,
            ],
            'impersonation' => $request->session()->has('impersonator_id') && $user ? [
                'user_name' => $user->name,
                'studio_name' => $user->studio->name ?? null,
            ] : null,
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'unread_messages' => fn () => $user ? Conversation::where('unread', true)->count() : 0,
            'notifications' => fn () => $user ? $user->notifications()->latest()->limit(15)->get()
                ->map(fn ($n) => [
                    'id' => $n->id,
                    'type' => $n->data['type'] ?? 'message',
                    'title' => $n->data['title'] ?? null,
                    'url' => $n->data['url'] ?? null,
                    'conversation_id' => $n->data['conversation_id'] ?? null,
                    'from_name' => $n->data['from_name'] ?? null,
                    'subject' => $n->data['subject'] ?? null,
                    'preview' => $n->data['preview'] ?? null,
                    'read' => $n->read_at !== null,
                    'created_at' => $n->created_at?->toIso8601String(),
                ]) : [],
            'unread_notifications' => fn () => $user ? $user->unreadNotifications()->count() : 0,
        ];
    }
}
