<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use App\Models\Concerns\HasPublicImage;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Package extends Model
{
    use BelongsToStudio, HasFactory, HasPublicImage;

    protected $fillable = [
        'studio_id',
        'name',
        'slug',
        'description',
        'details',
        'image_path',
        'price_cents',
        'pricing_type',
        'min_amount_cents',
        'suggested_amount_cents',
        'deposit_cents',
        'currency',
        'active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'price_cents' => 'integer',
            'min_amount_cents' => 'integer',
            'suggested_amount_cents' => 'integer',
            'deposit_cents' => 'integer',
            'active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /** A "pay what you want" / tip-jar link — the customer chooses the amount. */
    public function isFlexible(): bool
    {
        return $this->pricing_type === 'flexible';
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

    /** Whether a deposit option is offered (a deposit smaller than the full price). */
    public function offersDeposit(): bool
    {
        return $this->deposit_cents !== null && $this->deposit_cents > 0 && $this->deposit_cents < $this->price_cents;
    }
}
