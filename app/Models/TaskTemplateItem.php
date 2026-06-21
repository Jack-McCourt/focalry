<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskTemplateItem extends Model
{
    use HasFactory;

    protected $fillable = ['task_template_id', 'title', 'offset_days', 'position'];

    protected function casts(): array
    {
        return [
            'offset_days' => 'integer',
            'position' => 'integer',
        ];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(TaskTemplate::class, 'task_template_id');
    }
}
