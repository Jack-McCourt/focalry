<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Tier-3 builder batch: analytics detail, publish snapshots, authors, custom fonts. */
    public function up(): void
    {
        Schema::table('site_visits', function (Blueprint $table) {
            // Daily-rotating anonymous visitor hash (unique-visitor counts, no IPs stored).
            $table->string('visitor_hash', 40)->nullable()->after('referrer_host')->index();
            $table->string('device', 10)->nullable()->after('visitor_hash');
            $table->string('utm_source', 120)->nullable()->after('device');
            $table->string('utm_medium', 120)->nullable()->after('utm_source');
            $table->string('utm_campaign', 120)->nullable()->after('utm_medium');
        });

        Schema::create('site_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('site_id')->constrained()->cascadeOnDelete();
            /** The full builder payload that went live (same shape as sites.draft). */
            $table->json('payload');
            $table->timestamps();
        });

        Schema::table('sites', function (Blueprint $table) {
            $table->json('custom_fonts')->nullable()->after('footer');
        });

        Schema::table('site_pages', function (Blueprint $table) {
            $table->string('author')->nullable()->after('excerpt');
        });
    }

    public function down(): void
    {
        Schema::table('site_visits', fn (Blueprint $t) => $t->dropColumn(['visitor_hash', 'device', 'utm_source', 'utm_medium', 'utm_campaign']));
        Schema::dropIfExists('site_snapshots');
        Schema::table('sites', fn (Blueprint $t) => $t->dropColumn('custom_fonts'));
        Schema::table('site_pages', fn (Blueprint $t) => $t->dropColumn('author'));
    }
};
