<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Reusable question sets (wedding details, shot list, timeline inputs…).
        Schema::create('questionnaire_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            // [{ key, label, type(text|textarea|date|select|checkbox), options[], required }]
            $table->json('questions')->nullable();
            $table->timestamps();
        });

        // A questionnaire sent to a client, with a snapshot of the questions + answers.
        Schema::create('questionnaires', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('questionnaire_template_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            // draft → sent → completed
            $table->string('status')->default('draft');
            $table->json('questions')->nullable();   // snapshot at send time
            $table->json('answers')->nullable();     // { key: value }
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['studio_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('questionnaires');
        Schema::dropIfExists('questionnaire_templates');
    }
};
