<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Collection extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'contact_id',
        'title',
        'slug',
        'event_date',
        'cover_photo_id',
        'cover_style',
        'privacy',
        'download_settings',
        'favourite_settings',
        'price_sheet_id',
        'expires_at',
        'published_at',
        'status',
        'starred',
    ];

    protected function casts(): array
    {
        return [
            'event_date' => 'date',
            'cover_style' => 'array',
            'privacy' => 'array',
            'download_settings' => 'array',
            'favourite_settings' => 'array',
            'expires_at' => 'datetime',
            'published_at' => 'datetime',
            'starred' => 'boolean',
        ];
    }

    public function coverPhoto(): BelongsTo
    {
        return $this->belongsTo(Photo::class, 'cover_photo_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function sets(): HasMany
    {
        return $this->hasMany(Set::class)->orderBy('position');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(Photo::class)->orderBy('position');
    }

    public function videos(): HasMany
    {
        return $this->hasMany(Video::class)->orderBy('position');
    }

    public function visitors(): HasMany
    {
        return $this->hasMany(GalleryVisitor::class);
    }

    public function favouriteLists(): HasMany
    {
        return $this->hasMany(FavouriteList::class);
    }

    public function isPublished(): bool
    {
        return $this->status === 'published'
            && ($this->published_at === null || $this->published_at->isPast())
            && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    public function isPasswordProtected(): bool
    {
        return ! empty($this->privacy['password_hash']);
    }

    public function isEmailGated(): bool
    {
        return ! empty($this->privacy['email_gate']);
    }
}
