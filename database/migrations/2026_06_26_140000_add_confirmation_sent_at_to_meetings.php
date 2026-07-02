<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meetings', function (Blueprint $table) {
            // Set when the "booking confirmed" email has gone out, so re-syncing
            // a meeting never emails both parties twice.
            $table->timestamp('confirmation_sent_at')->nullable()->after('reminders_sent');
        });
    }

    public function down(): void
    {
        Schema::table('meetings', function (Blueprint $table) {
            $table->dropColumn('confirmation_sent_at');
        });
    }
};
