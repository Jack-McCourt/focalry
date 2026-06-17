<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectNote extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = ['studio_id', 'project_id', 'body'];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
