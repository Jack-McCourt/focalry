<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_pages', function (Blueprint $table) {
            // Visual options for the auto-generated post header (mirrors hero block
            // style keys: overlay, text_bg*, content_x/y, text_align, title_size,
            // text_shadow, height, height_value).
            $table->json('header')->nullable()->after('cover_focal');
        });
    }

    public function down(): void
    {
        Schema::table('site_pages', function (Blueprint $table) {
            $table->dropColumn('header');
        });
    }
};
