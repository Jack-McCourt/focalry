<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workflow_steps', function (Blueprint $table) {
            // after_trigger | before_event | after_event
            $table->string('schedule_mode')->default('after_trigger')->after('action');
            $table->unsignedInteger('offset_value')->default(0)->after('schedule_mode');
            // day | week | month
            $table->string('offset_unit')->default('day')->after('offset_value');
        });

        // Carry existing "wait N days after the trigger" values into the new fields.
        DB::table('workflow_steps')->update([
            'offset_value' => DB::raw('delay_days'),
        ]);
    }

    public function down(): void
    {
        Schema::table('workflow_steps', function (Blueprint $table) {
            $table->dropColumn(['schedule_mode', 'offset_value', 'offset_unit']);
        });
    }
};
