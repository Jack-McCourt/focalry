<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Path redirects: [{from, to}] resolved before page lookup.
        Schema::table('sites', function (Blueprint $table) {
            $table->json('redirects')->nullable()->after('og_image_url');
        });

        // A page can be designated the custom 404.
        Schema::table('site_pages', function (Blueprint $table) {
            $table->boolean('is_404')->default(false)->after('is_blog');
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn('redirects');
        });
        Schema::table('site_pages', function (Blueprint $table) {
            $table->dropColumn('is_404');
        });
    }
};
