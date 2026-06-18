<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class ClientEmail extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'contact_id',
        'emailable_type',
        'emailable_id',
        'sent_by',
        'to_email',
        'subject',
        'body',
        'details',
        'status',
        'error',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'details' => 'array',
            'sent_at' => 'datetime',
        ];
    }

    public function emailable(): MorphTo
    {
        return $this->morphTo();
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }
}
