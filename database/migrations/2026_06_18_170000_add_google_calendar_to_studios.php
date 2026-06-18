<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            // OAuth token bundle for the studio's connected Google Calendar:
            // { access_token, refresh_token, expires_at, calendar_id }.
            $table->json('google_calendar')->nullable()->after('email_signature');
            $table->string('google_calendar_email')->nullable()->after('google_calendar');
        });
    }

    public function down(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            $table->dropColumn(['google_calendar', 'google_calendar_email']);
        });
    }
};
