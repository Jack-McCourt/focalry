<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Builder saves land in `draft` (the full validated builder payload:
     * settings + pages) and only go live when the studio clicks Publish,
     * which applies the draft to the real columns/pages and clears it.
     */
    public function up(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->json('draft')->nullable()->after('saved_sections');
            $table->timestamp('draft_saved_at')->nullable()->after('draft');
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn(['draft', 'draft_saved_at']);
        });
    }
};
