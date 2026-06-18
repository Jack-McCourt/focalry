<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Site-level navigation: managed link lists for the global header + footer.
        // Guarded so it's a no-op on databases that already added these columns
        // under the previous (renamed) migration.
        Schema::table('sites', function (Blueprint $table) {
            if (! Schema::hasColumn('sites', 'header_nav')) {
                $table->json('header_nav')->nullable()->after('theme');
            }
            if (! Schema::hasColumn('sites', 'footer_nav')) {
                $table->json('footer_nav')->nullable()->after('header_nav');
            }
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn(['header_nav', 'footer_nav']);
        });
    }
};
