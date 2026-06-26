<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            // Auto-delete stale leads config: { enabled, value, unit }.
            $table->json('lead_settings')->nullable()->after('gallery_defaults');
        });
    }

    public function down(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            $table->dropColumn('lead_settings');
        });
    }
};
