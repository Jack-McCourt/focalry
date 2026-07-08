<?php

namespace App\Models;

use App\Support\PublicAsset;
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
        'timezone',
        'invoice_settings',
        'store_settings',
        'gallery_defaults',
        'lead_settings',
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
            'gallery_defaults' => 'array',
            'lead_settings' => 'array',
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

    /** IANA timezone the studio schedules in (falls back to the app default). */
    public function effectiveTimezone(): string
    {
        return $this->timezone ?: config('app.timezone');
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

    /**
     * Lead auto-deletion config with sensible fallbacks. When enabled, leads
     * (projects in the "Lead" status) older than value×unit are pruned by the
     * `leads:prune` scheduled command.
     *
     * @return array{enabled: bool, value: int, unit: 'days'|'weeks'|'months'}
     */
    public function leadSettings(): array
    {
        $s = $this->lead_settings ?? [];
        $unit = $s['unit'] ?? 'months';

        return [
            'enabled' => (bool) ($s['enabled'] ?? false),
            'value' => max(1, (int) ($s['value'] ?? 6)),
            'unit' => in_array($unit, ['days', 'weeks', 'months'], true) ? $unit : 'months',
        ];
    }

    public function logoUrl(): ?string
    {
        return PublicAsset::url($this->logo_path);
    }

    /**
     * The studio's chosen logo size (small | medium | large | xlarge). Applied
     * to client emails AND browser-viewed documents (contracts, invoices,
     * proposals, questionnaires, …). Stored under the branding blob.
     */
    public function logoSize(): string
    {
        $size = $this->branding['email_logo_size'] ?? 'medium';

        return in_array($size, ['small', 'medium', 'large', 'xlarge'], true) ? $size : 'medium';
    }

    /**
     * Pixel max-height for the logo in client emails. Medium (48px) is the
     * established default; large is roughly double, small roughly two-thirds,
     * and extra large is 50% larger than large.
     */
    public function emailLogoHeight(): int
    {
        return ['small' => 32, 'medium' => 48, 'large' => 96, 'xlarge' => 144][$this->logoSize()];
    }

    /**
     * Absolute filesystem path to the logo, for embedding in PDFs (dompdf needs a
     * local path). The logo lives in Wasabi, so cache a copy in the temp dir.
     */
    public function logoPath(): ?string
    {
        if (! $this->logo_path) {
            return null;
        }

        try {
            $tmp = sys_get_temp_dir().'/studio-logo-'.md5($this->logo_path).'.'.pathinfo($this->logo_path, PATHINFO_EXTENSION);
            if (! file_exists($tmp)) {
                file_put_contents($tmp, Storage::disk('wasabi')->get($this->logo_path));
            }

            return $tmp;
        } catch (\Throwable $e) {
            return null;
        }
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
