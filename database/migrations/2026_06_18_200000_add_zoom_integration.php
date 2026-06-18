<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            // OAuth token bundle for the studio's connected Zoom account:
            // { access_token, refresh_token, expires_at }.
            $table->json('zoom')->nullable()->after('google_calendar_email');
            $table->string('zoom_email')->nullable()->after('zoom');
        });

        Schema::table('meetings', function (Blueprint $table) {
            $table->string('zoom_meeting_id')->nullable()->after('google_event_id');
        });
    }

    public function down(): void
    {
        Schema::table('meetings', function (Blueprint $table) {
            $table->dropColumn('zoom_meeting_id');
        });

        Schema::table('studios', function (Blueprint $table) {
            $table->dropColumn(['zoom', 'zoom_email']);
        });
    }
};
