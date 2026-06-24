<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 0; }
        html, body { margin: 0; padding: 0; }
        * { font-family: 'DejaVu Sans', sans-serif; }

        /* No fixed widths — blocks fill the printable width and centre their
           contents, so the card stays centred whatever dompdf's page margin is. */
        body { color: #33302b; text-align: center; }

        .band {
            background: #f3ece2;
            border-bottom: 0.5mm solid #c8a878;
            padding: 5mm 9mm 4mm;
            text-align: center;
        }
        .studio {
            font-size: 9.5pt;
            letter-spacing: 3px;
            text-transform: uppercase;
            color: #8a6d49;
        }

        .body {
            padding: 6mm 9mm 6mm;
            text-align: center;
        }

        .title {
            font-family: 'DejaVu Serif', serif;
            font-size: 20pt;
            color: #2c2924;
            margin: 0 0 2mm;
        }

        /* Flourish: two rules flanking a small accent dot. */
        .flourish { margin: 0 auto 4mm; }
        .flourish .line {
            display: inline-block;
            width: 11mm;
            border-top: 0.4mm solid #c8a878;
            vertical-align: middle;
        }
        .flourish .dot {
            display: inline-block;
            width: 1.6mm;
            height: 1.6mm;
            background: #b88a52;
            border-radius: 50%;
            vertical-align: middle;
            margin: 0 2.5mm;
        }

        .message {
            font-size: 9.5pt;
            line-height: 1.45;
            color: #6f675c;
            margin: 0 4mm 6mm;
        }

        .qr {
            display: block;
            width: 36mm;
            height: 36mm;
            margin: 0 auto 4mm;
        }

        .scan {
            font-size: 8pt;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #a59a8a;
            margin-bottom: 6mm;
        }

        .pin-box {
            display: inline-block;
            background: #f3ece2;
            border: 0.5mm solid #dcc7a6;
            border-radius: 3mm;
            padding: 2.5mm 9mm;
        }
        .pin-label {
            font-size: 7pt;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #a07e54;
            margin-bottom: 1mm;
        }
        .pin {
            font-family: 'DejaVu Serif', serif;
            font-size: 19pt;
            font-weight: bold;
            letter-spacing: 6px;
            color: #2c2924;
        }
    </style>
</head>
<body>
    <div class="band">
        <div class="studio">{{ $studioName }}</div>
    </div>

    <div class="body">
        <div class="title">{{ $title }}</div>

        <div class="flourish">
            <span class="line"></span><span class="dot"></span><span class="line"></span>
        </div>

        <div class="message">{{ $message }}</div>

        <img class="qr" src="{{ $qrDataUri }}" alt="QR code">
        <div class="scan">Scan with your phone camera</div>

        @if ($pin)
            <div class="pin-box">
                <div class="pin-label">Entry PIN</div>
                <div class="pin">{{ $pin }}</div>
            </div>
        @endif
    </div>
</body>
</html>
