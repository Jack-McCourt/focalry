<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class GalleryVisitor extends Model
{
    protected $fillable = [
        'collection_id',
        'email',
        'name',
        'token',
        'last_seen_at',
    ];

    protected function casts(): array
    {
        return [
            'last_seen_at' => 'datetime',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function ($visitor) {
            if (! $visitor->token) {
                $visitor->token = Str::random(40);
            }
        });
    }

    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    public function favouriteLists(): HasMany
    {
        return $this->hasMany(FavouriteList::class, 'visitor_id');
    }
}
