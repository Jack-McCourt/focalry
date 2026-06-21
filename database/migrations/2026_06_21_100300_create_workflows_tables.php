<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            // project_created | project_status_changed | invoice_paid | contract_signed | questionnaire_completed
            $table->string('trigger');
            // Only for project_status_changed: which status entry fires the workflow.
            $table->foreignId('trigger_status_id')->nullable()->constrained('project_statuses')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['studio_id', 'trigger']);
        });

        Schema::create('workflow_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position')->default(0);
            // send_email | create_task | apply_task_template | send_questionnaire | change_status | create_note
            $table->string('action');
            $table->json('config')->nullable();
            // Days to wait after the trigger before running this step (0 = immediately).
            $table->unsignedInteger('delay_days')->default(0);
            $table->timestamps();

            $table->index(['workflow_id', 'position']);
        });

        // Audit row: one per time a workflow fires for a project.
        Schema::create('workflow_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workflow_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('triggered_at')->nullable();
            $table->timestamps();
        });

        // Delayed steps waiting for their run_at; processed by `workflows:run`.
        Schema::create('scheduled_workflow_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workflow_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workflow_step_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('run_at');
            $table->string('status')->default('pending'); // pending | done | failed
            $table->text('result')->nullable();
            $table->timestamps();

            $table->index(['status', 'run_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scheduled_workflow_actions');
        Schema::dropIfExists('workflow_runs');
        Schema::dropIfExists('workflow_steps');
        Schema::dropIfExists('workflows');
    }
};
