@php
    $fmtDate = fn ($d) => $d ? \Illuminate\Support\Carbon::parse($d)->format('j M Y') : '—';
    $studioSig = $contract->signatureFor('studio');
    $clientSig = $contract->signatureFor('client');
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { color: #1f2937; font-size: 12px; margin: 0; line-height: 1.55; }
        .wrap { padding: 48px; }
        .studio-name { font-size: 16px; font-weight: bold; }
        .muted { color: #6b7280; }
        .logo { max-height: 56px; max-width: 200px; margin-bottom: 6px; }
        h1.title { font-size: 22px; margin: 24px 0 4px; }
        .meta { color: #9ca3af; font-size: 11px; margin-bottom: 24px; }
        .body h1 { font-size: 18px; margin: 14px 0 6px; }
        .body h2 { font-size: 16px; margin: 14px 0 6px; }
        .body h3 { font-size: 14px; margin: 12px 0 4px; }
        .body p { margin: 8px 0; }
        .body ul, .body ol { margin: 8px 0; padding-left: 22px; }
        .sigs { width: 100%; margin-top: 48px; border-collapse: collapse; }
        .sigs td { width: 50%; vertical-align: bottom; padding: 0 16px; }
        .sig-box { border-bottom: 1px solid #9ca3af; height: 60px; padding-bottom: 4px; }
        .sig-typed { font-family: 'Comic Sans MS', cursive; font-size: 22px; color: #111827; }
        .sig-img { max-height: 56px; }
        .sig-label { font-size: 10px; text-transform: uppercase; color: #9ca3af; letter-spacing: .5px; margin-top: 6px; }
        .sig-name { font-size: 12px; margin-top: 2px; }
    </style>
</head>
<body>
<div class="wrap">
    @if ($studio?->logoPath())
        <img class="logo" src="{{ $studio->logoPath() }}" alt="">
    @endif
    <div class="studio-name">{{ $studio?->name }}</div>

    <h1 class="title">{{ $contract->title }}</h1>
    <div class="meta">
        @if ($contract->status === 'signed')
            Fully executed on {{ $fmtDate($contract->signed_at) }}
        @else
            Status: {{ ucfirst($contract->status) }}
        @endif
    </div>

    <div class="body">{!! $body !!}</div>

    <table class="sigs">
        <tr>
            @foreach (['studio' => 'Photographer', 'client' => 'Client'] as $role => $label)
                @php $sig = $role === 'studio' ? $studioSig : $clientSig; @endphp
                <td>
                    <div class="sig-box">
                        @if ($sig && $sig->signature_type === 'drawn' && $sig->signature_data)
                            <img class="sig-img" src="{{ $sig->signature_data }}" alt="">
                        @elseif ($sig)
                            <span class="sig-typed">{{ $sig->signer_name }}</span>
                        @endif
                    </div>
                    <div class="sig-label">{{ $label }}</div>
                    <div class="sig-name">
                        @if ($sig)
                            {{ $sig->signer_name }} · {{ $fmtDate($sig->signed_at) }}
                        @else
                            <span class="muted">Not yet signed</span>
                        @endif
                    </div>
                </td>
            @endforeach
        </tr>
    </table>
</div>
</body>
</html>
