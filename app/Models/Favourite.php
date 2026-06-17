<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Favourite extends Model
{
    protected $fillable = [
        'list_id',
        'photo_id',
        'note',
    ];

    public function list(): BelongsTo
    {
        return $this->belongsTo(FavouriteList::class, 'list_id');
    }

    public function photo(): BelongsTo
    {
        return $this->belongsTo(Photo::class);
    }
}
