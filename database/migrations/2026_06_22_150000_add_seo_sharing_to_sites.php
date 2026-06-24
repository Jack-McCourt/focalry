<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->string('favicon_url')->nullable()->after('seo_description');
            $table->string('og_image_url')->nullable()->after('favicon_url');
        });

        // Per-page social share image override.
        Schema::table('site_pages', function (Blueprint $table) {
            $table->string('og_image')->nullable()->after('body_code');
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn(['favicon_url', 'og_image_url']);
        });
        Schema::table('site_pages', function (Blueprint $table) {
            $table->dropColumn('og_image');
        });
    }
};
