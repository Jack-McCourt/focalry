<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Custom domains for studio websites: the hostname, a DNS-TXT ownership token,
 * when ownership was verified, and when the nginx vhost + TLS cert were
 * provisioned (so the site can actually be served over HTTPS on that domain).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->string('custom_domain')->nullable()->unique()->after('slug');
            $table->string('domain_token')->nullable()->after('custom_domain');
            $table->timestamp('domain_verified_at')->nullable()->after('domain_token');
            $table->timestamp('domain_provisioned_at')->nullable()->after('domain_verified_at');
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn(['custom_domain', 'domain_token', 'domain_verified_at', 'domain_provisioned_at']);
        });
    }
};
