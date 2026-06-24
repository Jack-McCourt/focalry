<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Injectable custom code for the published site: header code → <head>,
        // footer code → just before </body> (analytics, ad pixels, tag managers,
        // chat widgets, custom meta/styles). Injected as executable scripts on
        // the published site only — never in the authenticated builder.
        Schema::table('sites', function (Blueprint $table) {
            $table->text('head_code')->nullable()->after('footer_nav');
            $table->text('body_code')->nullable()->after('head_code');
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn(['head_code', 'body_code']);
        });
    }
};
