<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'name',
        'event_date',
        'status_id',
        'type_id',
        'contact_id',
        'collection_id',
        'notes',
        'custom_fields',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'event_date' => 'date',
            'custom_fields' => 'array',
            'position' => 'integer',
        ];
    }

    public function status(): BelongsTo
    {
        return $this->belongsTo(ProjectStatus::class, 'status_id');
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(ProjectType::class, 'type_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    /** Galleries that belong to this project. */
    public function collections(): HasMany
    {
        return $this->hasMany(Collection::class)->latest();
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class);
    }

    public function noteEntries(): HasMany
    {
        return $this->hasMany(ProjectNote::class)->latest();
    }

    /** Messages a studio user has tagged to this project. */
    public function taggedMessages(): HasMany
    {
        return $this->hasMany(Message::class)->latest();
    }

    /** To-do items attached to this project (incomplete first, then by due date). */
    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class)
            ->orderByRaw('completed_at is not null')
            ->orderByRaw('due_date is null')
            ->orderBy('due_date')
            ->orderBy('position');
    }

    /** Email invitations to view the read-only share page. */
    public function shares(): HasMany
    {
        return $this->hasMany(ProjectShare::class)->latest();
    }
}
