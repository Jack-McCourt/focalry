<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Contact extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'first_name',
        'last_name',
        'email',
        'phone',
        'company',
        'status',
        'notes',
        'tags',
    ];

    protected $appends = ['name'];

    protected function casts(): array
    {
        return [
            'tags' => 'array',
        ];
    }

    /**
     * Display name — full name, falling back to company or email.
     */
    protected function name(): Attribute
    {
        return Attribute::get(function () {
            $full = trim("{$this->first_name} {$this->last_name}");

            return $full !== '' ? $full : ($this->company ?: $this->email ?: 'Unnamed contact');
        });
    }

    public function collections(): HasMany
    {
        return $this->hasMany(Collection::class);
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }
}
