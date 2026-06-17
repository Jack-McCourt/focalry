<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Photo extends Model
{
    use BelongsToStudio, HasFactory;

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
