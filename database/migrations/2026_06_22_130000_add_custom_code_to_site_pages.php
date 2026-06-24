<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Per-page injectable code, layered on top of the site-wide head/body
        // code: header code → <head>, footer code → just before </body>, on the
        // published site only.
        Schema::table('site_pages', function (Blueprint $table) {
            $table->text('head_code')->nullable()->after('seo_description');
            $table->text('body_code')->nullable()->after('head_code');
        });
    }

    public function down(): void
    {
        Schema::table('site_pages', function (Blueprint $table) {
            $table->dropColumn(['head_code', 'body_code']);
        });
    }
};
