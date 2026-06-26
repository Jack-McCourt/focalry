<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workflows', function (Blueprint $table) {
            // Optional "if" guard: an array of {field, operator, value} rules the
            // project must satisfy for the workflow to run after its trigger fires.
            $table->json('conditions')->nullable()->after('trigger_status_id');
            // Whether every rule must pass ('all') or just one ('any').
            $table->string('condition_match')->default('all')->after('conditions');
        });
    }

    public function down(): void
    {
        Schema::table('workflows', function (Blueprint $table) {
            $table->dropColumn(['conditions', 'condition_match']);
        });
    }
};
