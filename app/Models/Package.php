<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class Package extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'name',
        'slug',
        'description',
        'details',
        'image_path',
        'price_cents',
        'deposit_cents',
        'currency',
        'active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'price_cents' => 'integer',
            'deposit_cents' => 'integer',
            'active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Package $package) {
            if (empty($package->slug)) {
                $package->slug = static::uniqueSlug((int) ($package->studio_id ?? app('current.studio.id')), $package->name);
            }
        });
    }

    public static function uniqueSlug(int $studioId, string $name): string
    {
        $base = Str::slug($name) ?: 'package';
        $slug = $base;
        $i = 2;
        while (static::withoutGlobalScopes()->where('studio_id', $studioId)->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(PackageBooking::class);
    }

    public function imageUrl(): ?string
    {
        return $this->image_path ? Storage::disk('public')->url($this->image_path) : null;
    }

    /** Whether a deposit option is offered (a deposit smaller than the full price). */
    public function offersDeposit(): bool
    {
        return $this->deposit_cents !== null && $this->deposit_cents > 0 && $this->deposit_cents < $this->price_cents;
    }
}
