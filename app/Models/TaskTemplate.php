<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class TaskTemplate extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = ['studio_id', 'name'];

    public function items(): HasMany
    {
        return $this->hasMany(TaskTemplateItem::class)->orderBy('position');
    }

    /**
     * Create real tasks on a project from this template's items, dating each one
     * relative to the project's event date (or today when there's no event date).
     */
    public function applyTo(Project $project, ?int $assignedTo = null): int
    {
        $base = $project->event_date ? Carbon::parse($project->event_date) : Carbon::today();
        $position = (int) Task::where('project_id', $project->id)->max('position');
        $created = 0;

        foreach ($this->items as $item) {
            Task::create([
                'studio_id' => $project->studio_id,
                'project_id' => $project->id,
                'assigned_to' => $assignedTo,
                'title' => $item->title,
                'due_date' => $base->copy()->addDays($item->offset_days)->toDateString(),
                'position' => ++$position,
            ]);
            $created++;
        }

        return $created;
    }
}
