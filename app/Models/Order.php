<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Order extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'collection_id',
        'price_sheet_id',
        'visitor_id',
        'contact_id',
        'public_id',
        'number',
        'customer_name',
        'customer_email',
        'customer_phone',
        'shipping_name',
        'shipping_line1',
        'shipping_line2',
        'shipping_city',
        'shipping_region',
        'shipping_postal_code',
        'shipping_country',
        'shipping_method_id',
        'coupon_id',
        'gift_card_id',
        'status',
        'fulfilment',
        'fulfil_after',
        'fulfilled_at',
        'digital_delivered_at',
        'currency',
        'subtotal_cents',
        'discount_cents',
        'gift_card_cents',
        'tax_cents',
        'shipping_cents',
        'total_cents',
        'platform_fee_cents',
        'cogs_cents',
        'payout_cents',
        'refunded_cents',
        'payment_method',
        'stripe_session_id',
        'stripe_payment_intent',
        'lab_order_ref',
        'shipping_carrier',
        'tracking_number',
        'tracking_url',
        'notes',
        'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'fulfil_after' => 'datetime',
            'fulfilled_at' => 'datetime',
            'digital_delivered_at' => 'datetime',
            'paid_at' => 'datetime',
            'subtotal_cents' => 'integer',
            'discount_cents' => 'integer',
            'gift_card_cents' => 'integer',
            'tax_cents' => 'integer',
            'shipping_cents' => 'integer',
            'total_cents' => 'integer',
            'platform_fee_cents' => 'integer',
            'cogs_cents' => 'integer',
            'payout_cents' => 'integer',
            'refunded_cents' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Order $order) {
            if (empty($order->public_id)) {
                $order->public_id = (string) Str::uuid();
            }
            if (empty($order->number)) {
                $order->number = 'ORD-'.strtoupper(Str::random(8));
            }
        });
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(OrderRefund::class);
    }

    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    public function visitor(): BelongsTo
    {
        return $this->belongsTo(GalleryVisitor::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }

    public function giftCard(): BelongsTo
    {
        return $this->belongsTo(GiftCard::class);
    }

    public function shippingMethod(): BelongsTo
    {
        return $this->belongsTo(ShippingMethod::class);
    }

    public function isPaid(): bool
    {
        return ! in_array($this->status, ['pending', 'cancelled'], true);
    }

    public function hasDigitalItems(): bool
    {
        return $this->items->contains(fn (OrderItem $i) => $i->fulfilment === 'digital');
    }

    public function refundableCents(): int
    {
        return max(0, $this->total_cents - $this->refunded_cents);
    }
}
