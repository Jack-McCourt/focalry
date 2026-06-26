<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Status is a project-only concept now; contacts no longer carry one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->dropIndex(['studio_id', 'status']);
            $table->dropColumn('status');
        });
    }

    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->string('status')->default('lead')->after('company');
            $table->index(['studio_id', 'status']);
        });
    }
};
