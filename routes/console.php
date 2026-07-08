<?php

use App\Models\SiteVisit;
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
// Release store orders whose review/delay window has passed.
Schedule::command('store:release-orders')->everyFifteenMinutes();
// Run delayed workflow steps whose scheduled time has arrived.
Schedule::command('workflows:run')->everyFifteenMinutes();
// Auto-delete stale leads (opt-in per studio) + purge trashed projects past retention.
Schedule::command('leads:prune')->dailyAt('03:00');
// Refresh Instagram tokens (~60-day lifetime) before they lapse.
Schedule::command('instagram:refresh-tokens')->weeklyOn(1, '05:00');
// Keep live-linked website gallery blocks in step with their client galleries.
Schedule::command('site:sync-linked-galleries')->dailyAt('04:00');
// Trim raw site-analytics page views past their retention (see SiteVisit::prunable).
Schedule::command('model:prune', ['--model' => [SiteVisit::class]])->dailyAt('03:30');
