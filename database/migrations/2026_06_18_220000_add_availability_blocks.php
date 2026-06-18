<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('availability_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->timestamps();

            $table->unique(['studio_id', 'date']);
        });

        Schema::table('studios', function (Blueprint $table) {
            // When on, days with a project on that date are not bookable.
            $table->boolean('block_project_dates')->default(false)->after('zoom_email');
        });
    }

    public function down(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            $table->dropColumn('block_project_dates');
        });

        Schema::dropIfExists('availability_blocks');
    }
};
