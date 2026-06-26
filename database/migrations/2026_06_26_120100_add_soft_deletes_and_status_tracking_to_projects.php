<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->softDeletes();
            // When the project last entered its current status — used to decide
            // how long a lead has sat in the "Lead" column.
            $table->timestamp('status_changed_at')->nullable()->after('status_id');
        });

        // Backfill existing rows with a sensible proxy so they're eligible for
        // (or excluded from) lead pruning right away.
        DB::table('projects')->whereNull('status_changed_at')
            ->update(['status_changed_at' => DB::raw('COALESCE(updated_at, created_at)')]);
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn('status_changed_at');
        });
    }
};
