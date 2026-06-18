<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
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
