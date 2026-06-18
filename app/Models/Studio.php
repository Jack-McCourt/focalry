<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use Laravel\Cashier\Billable;

class Studio extends Model
{
    use Billable, HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'email',
        'address_line1',
        'address_line2',
        'city',
        'region',
        'postal_code',
        'country',
        'logo_path',
        'watermark_path',
        'branding',
        'custom_domain',
        'default_currency',
        'invoice_settings',
        'email_signature',
        'plan',
        'commission_rate',
        'storage_used',
        'stripe_connect_id',
        'stripe_connect_status',
    ];

    protected function casts(): array
    {
        return [
            'branding' => 'array',
            'commission_rate' => 'integer',
            'storage_used' => 'integer',
            'invoice_settings' => 'array',
            'trial_ends_at' => 'datetime',
        ];
    }

    /**
     * Invoice defaults with sensible fallbacks.
     *
     * @return array{payment_methods: list<string>, bank_details: ?string, payment_terms: ?string, default_tax_rate: float}
     */
    public function invoiceSettings(): array
    {
        $s = $this->invoice_settings ?? [];

        return [
            'payment_methods' => $s['payment_methods'] ?? ['card'],
            'bank_details' => $s['bank_details'] ?? null,
            'payment_terms' => $s['payment_terms'] ?? null,
            'default_tax_rate' => (float) ($s['default_tax_rate'] ?? 0),
        ];
    }

    public function logoUrl(): ?string
    {
        return $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null;
    }

    /** Absolute filesystem path to the logo, for embedding in PDFs (dompdf). */
    public function logoPath(): ?string
    {
        return $this->logo_path && Storage::disk('public')->exists($this->logo_path)
            ? Storage::disk('public')->path($this->logo_path)
            : null;
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function collections(): HasMany
    {
        return $this->hasMany(Collection::class);
    }

    public function sites(): HasMany
    {
        return $this->hasMany(Site::class);
    }

    public function isOnFreePlan(): bool
    {
        return $this->plan === 'free';
    }

    public function effectiveCommissionRate(): int
    {
        return $this->isOnFreePlan() ? $this->commission_rate : 0;
    }
}
