<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Workflow extends Model
{
    use BelongsToStudio, HasFactory;

    /** Events that can start a workflow. */
    public const TRIGGERS = [
        'project_created' => 'A project is created',
        'project_status_changed' => 'A project moves to a status',
        'invoice_paid' => 'An invoice is paid',
        'contract_signed' => 'A contract is signed',
        'questionnaire_completed' => 'A questionnaire is completed',
        'proposal_accepted' => 'A proposal is accepted',
    ];

    /** Actions a step can perform. */
    public const ACTIONS = [
        'send_email' => 'Send an email to the client',
        'create_task' => 'Create a task',
        'apply_task_template' => 'Apply a task checklist',
        'send_questionnaire' => 'Send a questionnaire',
        'change_status' => 'Move the project to a status',
        'create_note' => 'Add a note to the project',
    ];

    /**
     * Operators a condition can use. Some compare a value the user supplies;
     * the presence operators (`is_set`/`is_not_set`) ignore the value field.
     */
    public const CONDITION_OPERATORS = [
        'equals' => 'is',
        'not_equals' => 'is not',
        'contains' => 'contains',
        'greater_than' => 'is greater than',
        'less_than' => 'is less than',
        'is_set' => 'has any value',
        'is_not_set' => 'is empty',
    ];

    /** Operators that don't need a comparison value. */
    public const VALUELESS_OPERATORS = ['is_set', 'is_not_set'];

    protected $fillable = [
        'studio_id',
        'name',
        'description',
        'trigger',
        'trigger_status_id',
        'conditions',
        'condition_match',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'conditions' => 'array',
        ];
    }

    public function steps(): HasMany
    {
        return $this->hasMany(WorkflowStep::class)->orderBy('position');
    }

    public function triggerStatus(): BelongsTo
    {
        return $this->belongsTo(ProjectStatus::class, 'trigger_status_id');
    }

    public function runs(): HasMany
    {
        return $this->hasMany(WorkflowRun::class);
    }
}
