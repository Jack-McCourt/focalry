<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Cookie-consent banner. When enabled, the site's tracking code is only
        // injected after the visitor accepts (GDPR/PECR consent gating).
        Schema::table('sites', function (Blueprint $table) {
            $table->boolean('cookie_consent')->default(false)->after('body_code');
            $table->text('cookie_message')->nullable()->after('cookie_consent');
            $table->string('cookie_policy_url')->nullable()->after('cookie_message');
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn(['cookie_consent', 'cookie_message', 'cookie_policy_url']);
        });
    }
};
