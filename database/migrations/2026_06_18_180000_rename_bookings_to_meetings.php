<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the FK before renaming the column it covers.
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign(['session_type_id']);
            $table->renameColumn('session_type_id', 'meeting_type_id');
        });

        Schema::rename('session_types', 'meeting_types');
        Schema::rename('bookings', 'meetings');

        Schema::table('meetings', function (Blueprint $table) {
            $table->foreign('meeting_type_id')->references('id')->on('meeting_types')->nullOnDelete();
        });

        Schema::table('meeting_types', function (Blueprint $table) {
            // google_meet | zoom — which provider supplies the video link.
            $table->string('video_provider')->default('google_meet')->after('location');
        });
    }

    public function down(): void
    {
        Schema::table('meeting_types', function (Blueprint $table) {
            $table->dropColumn('video_provider');
        });

        Schema::table('meetings', function (Blueprint $table) {
            $table->dropForeign(['meeting_type_id']);
        });

        Schema::rename('meetings', 'bookings');
        Schema::rename('meeting_types', 'session_types');

        Schema::table('bookings', function (Blueprint $table) {
            $table->renameColumn('meeting_type_id', 'session_type_id');
            $table->foreign('session_type_id')->references('id')->on('session_types')->nullOnDelete();
        });
    }
};
