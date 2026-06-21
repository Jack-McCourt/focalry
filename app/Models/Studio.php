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
        'store_settings',
        'email_signature',
        'google_calendar',
        'google_calendar_email',
        'zoom',
        'zoom_email',
        'block_project_dates',
        'plan',
        'suspended_at',
        'commission_rate',
        'storage_used',
        'storage_limit_override',
        'stripe_connect_id',
        'stripe_connect_status',
    ];

    protected function casts(): array
    {
        return [
            'branding' => 'array',
            'commission_rate' => 'integer',
            'storage_used' => 'integer',
            'storage_limit_override' => 'integer',
            'invoice_settings' => 'array',
            'store_settings' => 'array',
            'google_calendar' => 'array',
            'zoom' => 'array',
            'block_project_dates' => 'boolean',
            'trial_ends_at' => 'datetime',
            'suspended_at' => 'datetime',
        ];
    }

    public function isSuspended(): bool
    {
        return $this->suspended_at !== null;
    }

    public function googleCalendarConnected(): bool
    {
        return ! empty($this->google_calendar['refresh_token'] ?? null);
    }

    public function zoomConnected(): bool
    {
        return ! empty($this->zoom['refresh_token'] ?? null);
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

    /**
     * Store defaults with sensible fallbacks.
     *
     * @return array{hold_for_review: bool, review_window_hours: int}
     */
    public function storeSettings(): array
    {
        $s = $this->store_settings ?? [];

        return [
            'hold_for_review' => (bool) ($s['hold_for_review'] ?? false),
            'review_window_hours' => (int) ($s['review_window_hours'] ?? 24),
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
        return $this->planKey() === 'free';
    }

    /**
     * The studio's current plan key, falling back to 'free' for any value
     * that isn't a configured tier.
     */
    public function planKey(): string
    {
        $plan = $this->plan ?? 'free';

        return array_key_exists($plan, config('plans.tiers')) ? $plan : 'free';
    }

    /**
     * The full config block for the studio's current tier.
     *
     * @return array<string, mixed>
     */
    public function planConfig(): array
    {
        return config('plans.tiers.'.$this->planKey());
    }

    /** Commission is taken from the tier (15% on free, 0% on paid plans). */
    public function effectiveCommissionRate(): int
    {
        return (int) ($this->planConfig()['commission_rate'] ?? 0);
    }

    /**
     * Included storage in bytes, or null for unlimited. A super-admin override
     * (storage_limit_override) takes precedence over the plan's included cap.
     */
    public function storageLimit(): ?int
    {
        if ($this->storage_limit_override !== null) {
            return (int) $this->storage_limit_override;
        }

        return $this->planConfig()['storage'];
    }

    /** Remaining storage in bytes, or null when the plan is unlimited. */
    public function storageRemaining(): ?int
    {
        $limit = $this->storageLimit();

        if ($limit === null) {
            return null;
        }

        return max(0, $limit - (int) $this->storage_used);
    }

    /** Whether the studio has room for an upload of $bytes. */
    public function hasStorageFor(int $bytes): bool
    {
        $remaining = $this->storageRemaining();

        return $remaining === null || $bytes <= $remaining;
    }

    /** Whether the studio's current tier unlocks a given product area. */
    public function hasFeature(string $feature): bool
    {
        return in_array($feature, $this->planConfig()['features'] ?? [], true);
    }

    /**
     * Resolve the active Cashier subscription's price back to a plan key and
     * cache it on the `plan` column. Called from Stripe webhooks. Returns the
     * resolved key (defaults to 'free' when there's no active paid plan).
     */
    public function syncPlanFromSubscription(): string
    {
        $key = 'free';

        $subscription = $this->subscription('default');

        if ($subscription && $subscription->valid()) {
            $priceId = $subscription->stripe_price
                ?? $subscription->items->first()?->stripe_price;

            foreach (config('plans.tiers') as $tierKey => $tier) {
                if (in_array($priceId, [$tier['stripe']['monthly'] ?? null, $tier['stripe']['yearly'] ?? null], true)
                    && $priceId !== null) {
                    $key = $tierKey;
                    break;
                }
            }
        }

        if ($this->plan !== $key) {
            $this->forceFill(['plan' => $key])->save();
        }

        return $key;
    }
}
