<?php

namespace App\Models\Concerns;

use App\Models\Studio;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Adds studio-scoped tenancy to any model with a studio_id column.
 * Boot method automatically restricts queries to the current studio
 * (resolved via CurrentStudio facade / middleware).
 */
trait BelongsToStudio
{
    public static function bootBelongsToStudio(): void
    {
        static::addGlobalScope('studio', function (Builder $query) {
            if ($studioId = app('current.studio.id')) {
                $query->where((new static)->qualifyColumn('studio_id'), $studioId);
            }
        });

        static::creating(function ($model) {
            if (! $model->studio_id && ($studioId = app('current.studio.id'))) {
                $model->studio_id = $studioId;
            }
        });
    }

    public function studio(): BelongsTo
    {
        return $this->belongsTo(Studio::class);
    }
}
