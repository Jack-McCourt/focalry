@php
    $cur = strtoupper($invoice->currency);
    $money = fn ($c) => $cur.' '.number_format(((int) $c) / 100, 2);
    $fmtDate = fn ($d) => $d ? \Illuminate\Support\Carbon::parse($d)->format('j M Y') : '—';
    $addr = array_filter([
        $studio->address_line1 ?? null,
        $studio->address_line2 ?? null,
        trim(implode(' ', array_filter([$studio->city ?? null, $studio->postal_code ?? null]))),
        $studio->region ?? null,
        $studio->country ?? null,
    ]);
    $balance = $invoice->balanceCents();
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { color: #1f2937; font-size: 12px; margin: 0; }
        .wrap { padding: 40px; }
        .head { width: 100%; }
        .head td { vertical-align: top; }
        .logo { max-height: 64px; max-width: 220px; }
        .studio-name { font-size: 18px; font-weight: bold; }
        .muted { color: #6b7280; }
        h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: 1px; }
        .pill { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
        .pill-paid { background: #ecfdf5; color: #047857; }
        .pill-open { background: #eff6ff; color: #1d4ed8; }
        .pill-void { background: #f3f4f6; color: #9ca3af; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 28px; }
        table.items th { text-align: left; border-bottom: 1px solid #e5e7eb; padding: 8px 0; font-size: 10px; text-transform: uppercase; color: #9ca3af; }
        table.items td { padding: 9px 0; border-bottom: 1px solid #f3f4f6; }
        .right { text-align: right; }
        .totals { width: 45%; margin-left: 55%; margin-top: 16px; }
        .totals td { padding: 4px 0; }
        .totals .grand td { border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 14px; font-weight: bold; }
        .section-title { font-size: 10px; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px; }
        .notes { margin-top: 28px; color: #4b5563; white-space: pre-wrap; }
    </style>
</head>
<body>
<div class="wrap">
    <table class="head">
        <tr>
            <td style="width: 55%;">
                @if ($logoPath)
                    <img class="logo" src="{{ $logoPath }}" alt="">
                @else
                    <div class="studio-name">{{ $studio->name }}</div>
                @endif
                <div class="muted" style="margin-top: 8px;">
                    @if ($logoPath)<div class="studio-name" style="font-size:14px;color:#111;">{{ $studio->name }}</div>@endif
                    @foreach ($addr as $line)
                        {{ $line }}<br>
                    @endforeach
                </div>
            </td>
            <td class="right" style="width: 45%;">
                <h1>INVOICE</h1>
                <div class="muted">{{ $invoice->number }}</div>
                <div style="margin-top: 8px;">
                    @php
                        $pill = $invoice->status === 'paid' ? 'pill-paid' : ($invoice->status === 'void' ? 'pill-void' : 'pill-open');
                    @endphp
                    <span class="pill {{ $pill }}">{{ $invoice->status }}</span>
                </div>
                <div class="muted" style="margin-top: 10px;">
                    Issued: {{ $fmtDate($invoice->issue_date) }}<br>
                    Due: {{ $fmtDate($invoice->due_date) }}
                </div>
            </td>
        </tr>
    </table>

    @if ($invoice->contact)
        <div style="margin-top: 28px;">
            <div class="section-title">Bill to</div>
            <strong>{{ $invoice->contact->name }}</strong>
            @if ($invoice->contact->email)<br><span class="muted">{{ $invoice->contact->email }}</span>@endif
        </div>
    @endif

    <table class="items">
        <thead>
            <tr>
                <th>Description</th>
                <th class="right">Qty</th>
                <th class="right">Unit</th>
                <th class="right">Amount</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($invoice->items as $item)
                <tr>
                    <td>{{ $item->description }}</td>
                    <td class="right">{{ rtrim(rtrim((string) $item->quantity, '0'), '.') }}</td>
                    <td class="right">{{ $money($item->unit_amount_cents) }}</td>
                    <td class="right">{{ $money($item->amountCents()) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="totals">
        <tr><td class="muted">Subtotal</td><td class="right">{{ $money($invoice->subtotal_cents) }}</td></tr>
        @if ($invoice->discount_cents > 0)
            <tr><td class="muted">Discount</td><td class="right">−{{ $money($invoice->discount_cents) }}</td></tr>
        @endif
        @if ($invoice->tax_cents > 0)
            <tr><td class="muted">Tax ({{ rtrim(rtrim((string) $invoice->tax_rate, '0'), '.') }}%)</td><td class="right">{{ $money($invoice->tax_cents) }}</td></tr>
        @endif
        <tr class="grand"><td>Total</td><td class="right">{{ $money($invoice->total_cents) }}</td></tr>
        @if ($invoice->amount_paid_cents > 0)
            <tr><td style="color:#047857;">Paid</td><td class="right" style="color:#047857;">−{{ $money($invoice->amount_paid_cents) }}</td></tr>
            <tr><td><strong>Balance due</strong></td><td class="right"><strong>{{ $money($balance) }}</strong></td></tr>
        @endif
    </table>

    @if ($invoice->schedules->isNotEmpty())
        <div style="margin-top: 36px;">
            <div class="section-title">Payment schedule</div>
            <table class="items" style="margin-top: 6px;">
                @foreach ($invoice->schedules as $s)
                    <tr>
                        <td class="muted">Due {{ $fmtDate($s->due_date) }}</td>
                        <td class="right">{{ $money($s->amount_cents) }}</td>
                    </tr>
                @endforeach
            </table>
        </div>
    @endif

    @if ($invoice->notes)
        <div class="notes">{{ $invoice->notes }}</div>
    @endif
</div>
</body>
</html>
