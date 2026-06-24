<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A library of reusable sections: [{id, name, block}]. Inserting one
        // drops a fresh copy into a page (Squarespace-style saved sections).
        Schema::table('sites', function (Blueprint $table) {
            $table->json('saved_sections')->nullable()->after('redirects');
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn('saved_sections');
        });
    }
};
