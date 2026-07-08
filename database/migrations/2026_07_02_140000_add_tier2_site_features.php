<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Announcement bar, social links, footer info, coming-soon + draft preview. */
    public function up(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->json('announcement')->nullable()->after('footer_nav');
            $table->json('social')->nullable()->after('announcement');
            $table->json('footer')->nullable()->after('social');
            $table->boolean('coming_soon')->default(false)->after('is_published');
            $table->string('preview_token', 64)->nullable()->unique()->after('coming_soon');
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn(['announcement', 'social', 'footer', 'coming_soon', 'preview_token']);
        });
    }
};
