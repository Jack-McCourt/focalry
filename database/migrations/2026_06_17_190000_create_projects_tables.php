<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_statuses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->string('color', 7)->default('#6b7280'); // hex
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['studio_id', 'position']);
        });

        Schema::create('project_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->string('color', 7)->default('#6b7280');
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['studio_id', 'position']);
        });

        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->date('event_date')->nullable();
            $table->foreignId('status_id')->nullable()->constrained('project_statuses')->nullOnDelete();
            $table->foreignId('type_id')->nullable()->constrained('project_types')->nullOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('collection_id')->nullable()->constrained()->nullOnDelete();
            $table->text('notes')->nullable();
            $table->json('custom_fields')->nullable();
            $table->unsignedInteger('position')->default(0); // order within a kanban column
            $table->timestamps();

            $table->index(['studio_id', 'status_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
        Schema::dropIfExists('project_types');
        Schema::dropIfExists('project_statuses');
    }
};
