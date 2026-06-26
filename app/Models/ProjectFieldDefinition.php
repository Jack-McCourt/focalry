<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProjectFieldDefinition extends Model
{
    use BelongsToStudio, HasFactory;

    public const TYPES = ['text', 'long_text', 'number', 'date', 'select', 'checkbox', 'url', 'image', 'file'];

    protected $fillable = ['studio_id', 'key', 'label', 'type', 'options', 'position'];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'position' => 'integer',
        ];
    }
}
