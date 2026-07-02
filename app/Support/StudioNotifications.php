<?php

namespace App\Support;

use App\Models\User;
use App\Notifications\StudioEvent;
use Illuminate\Support\Facades\Notification;

/**
 * Fan a business event out to every user of a studio as a {@see StudioEvent}.
 * Single call site for the dozen-odd places that raise studio notifications, so
 * the "who gets notified" rule lives in one place.
 */
class StudioNotifications
{
    public static function send(int $studioId, string $type, string $title, string $message, ?string $url = null, string $actionText = 'View'): void
    {
        $users = User::where('studio_id', $studioId)->get();
        if ($users->isEmpty()) {
            return;
        }

        Notification::send($users, new StudioEvent($type, $title, $message, $url, $actionText));
    }
}
