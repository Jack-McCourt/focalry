<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_pages', function (Blueprint $table) {
            // Categories the blog page hides from its filter links. Stored as
            // exclusions so every category (incl. ones added later) shows by default.
            $table->json('hidden_category_ids')->nullable()->after('category_ids');
        });
    }

    public function down(): void
    {
        Schema::table('site_pages', function (Blueprint $table) {
            $table->dropColumn('hidden_category_ids');
        });
    }
};
