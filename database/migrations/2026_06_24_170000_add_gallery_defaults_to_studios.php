<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A studio-level template of gallery settings (theme, cover, downloads,
 * favourites, guest uploads, price sheet) applied to every newly created
 * gallery, so studios configure their preferred defaults once.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            $table->json('gallery_defaults')->nullable()->after('store_settings');
        });
    }

    public function down(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            $table->dropColumn('gallery_defaults');
        });
    }
};
