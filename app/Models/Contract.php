<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use App\Support\Money;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class Contract extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'project_id',
        'contact_id',
        'title',
        'body',
        'fields',
        'status',
        'sent_at',
        'signed_at',
    ];

    protected function casts(): array
    {
        return [
            'fields' => 'array',
            'sent_at' => 'datetime',
            'signed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Contract $contract) {
            if (empty($contract->public_id)) {
                $contract->public_id = (string) Str::uuid();
            }
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function signatures(): HasMany
    {
        return $this->hasMany(ContractSignature::class);
    }

    public function signatureFor(string $role): ?ContractSignature
    {
        return $this->signatures->firstWhere('role', $role);
    }

    /**
     * Resolved values for every merge token (built-ins + custom fields).
     *
     * @return array<string, string>
     */
    public function mergeValues(): array
    {
        $this->loadMissing(['contact', 'project', 'studio']);

        $values = [
            'client_name' => $this->contact?->name ?? '',
            'project_name' => $this->project?->name ?? '',
            'event_date' => $this->project?->event_date?->format('F j, Y') ?? '',
            'studio_name' => $this->studio?->name ?? '',
            'today' => now()->format('F j, Y'),
        ];

        foreach ($this->fields ?? [] as $field) {
            $type = $field['type'] ?? null;
            $value = $field['value'] ?? null;

            if ($type === 'invoice') {
                $values[$field['key']] = $this->renderInvoiceField($value);

                continue;
            }
            if ($type === 'checkbox') {
                $value = $value ? 'Yes' : 'No';
            } elseif ($type === 'date' && $value) {
                try {
                    $value = Carbon::parse($value)->format('F j, Y');
                } catch (\Throwable) {
                    // leave the raw value if it isn't a parseable date
                }
            }
            $resolved = (string) ($value ?? '');

            // An empty custom field must not clobber an auto-resolved built-in
            // token (e.g. a blank event_date field falls back to the project's).
            if ($resolved === '' && array_key_exists($field['key'], $values)) {
                continue;
            }

            $values[$field['key']] = $resolved;
        }

        return $values;
    }

    /**
     * HTML for each invoice-type field, keyed by field key. Used to render the
     * payment breakdown in the studio preview (the body/PDF already inline it).
     *
     * @return array<string, string>
     */
    public function invoiceBlocks(): array
    {
        $out = [];
        foreach ($this->fields ?? [] as $field) {
            if (($field['type'] ?? null) === 'invoice') {
                $out[$field['key']] = $this->renderInvoiceField($field['value'] ?? null);
            }
        }

        return $out;
    }

    /**
     * Render a linked invoice's payment schedule (amounts + due dates) as an
     * HTML table that drops straight into the contract body.
     */
    protected function renderInvoiceField(mixed $invoiceId): string
    {
        $placeholder = '<p><em style="color:#9ca3af;">Payment schedule to be confirmed.</em></p>';

        if (! $invoiceId) {
            return $placeholder;
        }

        $invoice = Invoice::with('schedules')->find($invoiceId);
        if (! $invoice) {
            return $placeholder;
        }

        $fmt = fn (int $cents) => Money::format($cents, $invoice->currency);
        $fmtDate = fn ($d) => $d ? Carbon::parse($d)->format('j M Y') : 'TBC';

        $schedules = $invoice->schedules->sortBy('position')->values();
        $rows = '';

        if ($schedules->isEmpty()) {
            $rows = '<tr><td style="padding:6px 0;">Amount due'
                .($invoice->due_date ? ' by '.$fmtDate($invoice->due_date) : '')
                .'</td><td style="padding:6px 0;text-align:right;">'.$fmt((int) $invoice->total_cents).'</td></tr>';
        } else {
            foreach ($schedules as $i => $s) {
                $label = $schedules->count() > 1 ? 'Payment '.($i + 1).' of '.$schedules->count() : 'Payment';
                $rows .= '<tr><td style="padding:6px 0;">'.$label
                    .' <span style="color:#6b7280;">(due '.$fmtDate($s->due_date).')</span></td>'
                    .'<td style="padding:6px 0;text-align:right;">'.$fmt((int) $s->amount_cents).'</td></tr>';
            }
        }

        return '<table style="width:100%;border-collapse:collapse;margin:10px 0;">'
            .'<tbody>'.$rows.'</tbody>'
            .'<tfoot><tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;font-weight:bold;">Total</td>'
            .'<td style="padding:6px 0;border-top:1px solid #e5e7eb;text-align:right;font-weight:bold;">'.$fmt((int) $invoice->total_cents).'</td></tr></tfoot>'
            .'</table>';
    }

    /**
     * Contract body with merge tokens replaced by their resolved values.
     * Unfilled tokens are left as the original {{token}} so they remain visible.
     */
    public function renderedBody(): string
    {
        $values = $this->mergeValues();

        return preg_replace_callback(
            '/\{\{\s*(\w+)\s*\}\}/',
            fn (array $m) => array_key_exists($m[1], $values) ? $values[$m[1]] : $m[0],
            (string) $this->body,
        );
    }
}
