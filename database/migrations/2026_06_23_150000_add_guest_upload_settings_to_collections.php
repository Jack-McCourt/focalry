<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Guest QR uploads: per-collection settings for the public, PIN-gated upload page
 * that guests reach by scanning a printed QR card. Shape (JSON):
 *   { enabled, pin, require_approval, show_as_tab, set_id, title, message }
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('collections', function (Blueprint $table) {
            $table->json('guest_upload_settings')->nullable()->after('download_settings');
        });
    }

    public function down(): void
    {
        Schema::table('collections', function (Blueprint $table) {
            $table->dropColumn('guest_upload_settings');
        });
    }
};
