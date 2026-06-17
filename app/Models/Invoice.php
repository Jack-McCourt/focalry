<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class Invoice extends Model
{
    use BelongsToStudio, HasFactory;

    protected static function booted(): void
    {
        static::creating(function (Invoice $invoice) {
            if (empty($invoice->public_id)) {
                $invoice->public_id = (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'studio_id',
        'contact_id',
        'project_id',
        'number',
        'status',
        'currency',
        'issue_date',
        'due_date',
        'event_date',
        'discount_cents',
        'tax_rate',
        'notes',
        'payment_methods',
        'reminder_offsets',
        'reminders_sent',
        'sent_at',
        'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'due_date' => 'date',
            'event_date' => 'date',
            'tax_rate' => 'decimal:2',
            'payment_methods' => 'array',
            'reminder_offsets' => 'array',
            'reminders_sent' => 'array',
            'sent_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class)->orderBy('position');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(InvoicePayment::class)->latest('paid_on');
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(PaymentSchedule::class)->orderBy('position');
    }

    /**
     * Outstanding amounts that should trigger reminders, each with a key + due date.
     * Uses the payment schedule if present (allocating payments in order), otherwise
     * falls back to a single target on the invoice due date.
     *
     * @return array<int, array{key: string, due_date: Carbon, amount_cents: int}>
     */
    public function reminderTargets(): array
    {
        $targets = [];

        if ($this->schedules->isNotEmpty()) {
            $remainingPaid = (int) $this->amount_paid_cents;

            foreach ($this->schedules as $schedule) {
                $covered = min($remainingPaid, (int) $schedule->amount_cents);
                $remainingPaid -= $covered;
                $outstanding = (int) $schedule->amount_cents - $covered;

                if ($outstanding > 0 && $schedule->due_date) {
                    $targets[] = [
                        'key' => "s{$schedule->id}",
                        'due_date' => $schedule->due_date,
                        'amount_cents' => $outstanding,
                    ];
                }
            }
        } elseif ($this->due_date && $this->balanceCents() > 0) {
            $targets[] = [
                'key' => 'due',
                'due_date' => $this->due_date,
                'amount_cents' => $this->balanceCents(),
            ];
        }

        return $targets;
    }

    /**
     * Recompute money columns from the current line items + discount + tax.
     * Does not persist payments — `amount_paid_cents` is owned by recordPayment().
     */
    public function recalculateTotals(): void
    {
        $subtotal = $this->items->sum(fn (InvoiceItem $item) => $item->amountCents());
        $discount = min((int) $this->discount_cents, $subtotal);
        $taxable = $subtotal - $discount;
        $tax = (int) round($taxable * ((float) $this->tax_rate) / 100);

        $this->subtotal_cents = $subtotal;
        $this->tax_cents = $tax;
        $this->total_cents = $taxable + $tax;
    }

    /**
     * Sync paid total + status from recorded payments. Call after a payment changes.
     */
    public function syncPaymentState(): void
    {
        $paid = (int) $this->payments()->sum('amount_cents');
        $this->amount_paid_cents = $paid;

        if ($this->status !== 'void') {
            if ($paid <= 0) {
                $this->status = $this->sent_at ? 'sent' : 'draft';
                $this->paid_at = null;
            } elseif ($paid >= $this->total_cents) {
                $this->status = 'paid';
                $this->paid_at = $this->paid_at ?? now();
            } else {
                $this->status = 'partial';
                $this->paid_at = null;
            }
        }

        $this->save();
    }

    public function balanceCents(): int
    {
        return max(0, (int) $this->total_cents - (int) $this->amount_paid_cents);
    }

    /**
     * The amount a client should pay next: the first outstanding instalment if a
     * schedule exists, otherwise the whole balance. Clamped to the balance.
     */
    public function payableCents(): int
    {
        $targets = $this->reminderTargets();
        $next = $targets[0]['amount_cents'] ?? $this->balanceCents();

        return min((int) $next, $this->balanceCents());
    }
}
