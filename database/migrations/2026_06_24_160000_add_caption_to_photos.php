<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Optional message a guest can attach to their upload (e.g. a well-wish or a
 * note about the photo). Shown on the guest wall and in the studio's moderation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->string('caption', 500)->nullable()->after('uploader_name');
        });
    }

    public function down(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->dropColumn('caption');
        });
    }
};
