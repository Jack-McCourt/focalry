<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    /** The full notification inbox (the bell only shows the latest few). */
    public function index(Request $request): Response
    {
        $query = $request->user()->notifications();
        if ($request->boolean('unread')) {
            $query->whereNull('read_at');
        }

        $notifications = $query->paginate(30)->through(fn ($n) => [
            'id' => $n->id,
            'type' => $n->data['type'] ?? 'message',
            'title' => $n->data['title'] ?? (! empty($n->data['from_name']) ? "New reply from {$n->data['from_name']}" : 'Notification'),
            'preview' => $n->data['preview'] ?? $n->data['subject'] ?? null,
            'url' => $n->data['url'] ?? (! empty($n->data['conversation_id']) ? route('messages.show', $n->data['conversation_id']) : null),
            'read' => $n->read_at !== null,
            'created_at' => $n->created_at?->toIso8601String(),
        ]);

        return Inertia::render('Notifications/Index', [
            'notifications' => $notifications,
            'filter' => $request->boolean('unread') ? 'unread' : 'all',
            'unread_total' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    public function markRead(Request $request, string $notification): RedirectResponse
    {
        $request->user()->notifications()->where('id', $notification)->update(['read_at' => now()]);

        return back();
    }

    public function markAllRead(Request $request): RedirectResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return back();
    }
}
