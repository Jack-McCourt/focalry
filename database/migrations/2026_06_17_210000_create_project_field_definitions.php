<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_field_definitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('key');   // slug used as the key in projects.custom_fields JSON
            $table->string('label');
            $table->string('type')->default('text'); // text|long_text|number|date|select|checkbox|url
            $table->json('options')->nullable(); // for select: [{label,color}]
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->unique(['studio_id', 'key']);
            $table->index(['studio_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_field_definitions');
    }
};
