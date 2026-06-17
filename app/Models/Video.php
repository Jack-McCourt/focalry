<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Video extends Model
{
    use BelongsToStudio;

    protected $fillable = [
        'studio_id',
        'collection_id',
        'set_id',
        'filename',
        'wasabi_key',
        'thumbnail_key',
        'file_size',
        'status',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'position' => 'integer',
        ];
    }

    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    public function set(): BelongsTo
    {
        return $this->belongsTo(Set::class);
    }

    public function isReady(): bool
    {
        return $this->status === 'ready';
    }
}
