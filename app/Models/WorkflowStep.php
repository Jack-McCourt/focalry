<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowStep extends Model
{
    use HasFactory;

    /** When a step runs, relative to either the trigger or the project's event date. */
    public const SCHEDULE_MODES = [
        'after_trigger' => 'After the trigger',
        'before_event' => 'Before the event date',
        'after_event' => 'After the event date',
    ];

    public const OFFSET_UNITS = ['day', 'week', 'month'];

    protected $fillable = [
        'workflow_id',
        'position',
        'action',
        'config',
        'schedule_mode',
        'offset_value',
        'offset_unit',
        'delay_days',
    ];

    protected function casts(): array
    {
        return [
            'config' => 'array',
            'position' => 'integer',
            'offset_value' => 'integer',
            'delay_days' => 'integer',
        ];
    }

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class);
    }
}
