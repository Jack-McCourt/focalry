<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->text('notes')->nullable();
            $table->date('due_date')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['studio_id', 'completed_at']);
            $table->index(['project_id']);
        });

        // A named, reusable checklist a studio can apply to a project in one click.
        Schema::create('task_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('task_template_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_template_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            // Days relative to the project event date (negative = before the event).
            $table->integer('offset_days')->default(0);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['task_template_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_template_items');
        Schema::dropIfExists('task_templates');
        Schema::dropIfExists('tasks');
    }
};
