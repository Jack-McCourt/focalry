<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MessageTemplate extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'name',
        'body',
    ];
}
