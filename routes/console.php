<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ─── Scheduled tasks ──────────────────────────────────────────────────────────
Schedule::command('horizon:snapshot')->everyFiveMinutes();
Schedule::command('telescope:prune --hours=48')->daily();
Schedule::command('pulse:check')->everyMinute();
Schedule::command('invoices:send-payment-reminders')->dailyAt('08:00');
// Hourly so the 1-hour-before meeting reminder lands on time.
Schedule::command('meetings:send-reminders')->hourly();
