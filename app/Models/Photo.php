<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class Photo extends Model
{
    use BelongsToStudio, HasFactory;

    /**
     * Keep the studio's storage meter in sync as photos come and go so plan
     * quotas can be enforced. Bulk/cascade deletes (e.g. deleting a whole
     * collection) bypass these events and are accounted for explicitly.
     */
    protected static function booted(): void
    {
        static::created(function (Photo $photo): void {
            if ($photo->file_size && $photo->studio_id) {
                Studio::whereKey($photo->studio_id)->increment('storage_used', $photo->file_size);
            }
        });

        static::deleted(function (Photo $photo): void {
            if ($photo->file_size && $photo->studio_id) {
                Studio::whereKey($photo->studio_id)->update([
                    'storage_used' => DB::raw('GREATEST(0, storage_used - '.(int) $photo->file_size.')'),
                ]);
            }
        });
    }

    protected $fillable = [
        'studio_id',
        'collection_id',
        'set_id',
        'filename',
        'wasabi_key_original',
        'derivative_keys',
        'width',
        'height',
        'file_size',
        'exif_taken_at',
        'status',
        'position',
        'starred',
    ];

    protected function casts(): array
    {
        return [
            'derivative_keys' => 'array',
            'exif_taken_at' => 'datetime',
            'starred' => 'boolean',
            'position' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'file_size' => 'integer',
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

    public function favourites(): HasMany
    {
        return $this->hasMany(Favourite::class);
    }

    public function isReady(): bool
    {
        return $this->status === 'ready';
    }

    public function derivativeKey(string $variant): ?string
    {
        return $this->derivative_keys[$variant] ?? null;
    }

    public function aspectRatio(): ?float
    {
        if ($this->width && $this->height) {
            return round($this->width / $this->height, 4);
        }

        return null;
    }

    public function signedUrl(string $variant, int $minutes = 60): ?string
    {
        $key = $this->derivativeKey($variant);

        return $key ? Storage::disk('wasabi')->temporaryUrl($key, now()->addMinutes($minutes)) : null;
    }
}
