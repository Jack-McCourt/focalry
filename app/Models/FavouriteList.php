<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FavouriteList extends Model
{
    protected $fillable = [
        'collection_id',
        'visitor_id',
        'name',
        'selection_limit',
    ];

    protected function casts(): array
    {
        return [
            'selection_limit' => 'integer',
        ];
    }

    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    public function visitor(): BelongsTo
    {
        return $this->belongsTo(GalleryVisitor::class, 'visitor_id');
    }

    public function favourites(): HasMany
    {
        return $this->hasMany(Favourite::class, 'list_id');
    }

    public function photos()
    {
        return $this->hasManyThrough(Photo::class, Favourite::class, 'list_id', 'id', 'id', 'photo_id');
    }

    public function hasReachedLimit(): bool
    {
        if ($this->selection_limit === null) {
            return false;
        }

        return $this->favourites()->count() >= $this->selection_limit;
    }
}
