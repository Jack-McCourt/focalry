<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Instagram connection for the website's Instagram feed block. */
    public function up(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->string('instagram_username')->nullable()->after('cookie_policy_url');
            $table->text('instagram_token')->nullable()->after('instagram_username');
            $table->timestamp('instagram_token_expires_at')->nullable()->after('instagram_token');
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn(['instagram_username', 'instagram_token', 'instagram_token_expires_at']);
        });
    }
};
