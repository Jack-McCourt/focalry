<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-studio Cloudflare Turnstile credentials. Each studio brings its own
     * (free) widget — so hostname allow-listing lives in THEIR Cloudflare
     * account, sidestepping the shared-widget hostname cap on custom domains.
     * Falls back to the platform-level env keys when unset.
     */
    public function up(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->string('turnstile_site_key')->nullable()->after('instagram_token_expires_at');
            $table->text('turnstile_secret_key')->nullable()->after('turnstile_site_key');
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn(['turnstile_site_key', 'turnstile_secret_key']);
        });
    }
};
