@php
    $when = match (true) {
        $offsetDays < 0 => abs($offsetDays).' day'.(abs($offsetDays) === 1 ? '' : 's').' from now',
        $offsetDays === 0 => 'today',
        default => $offsetDays.' day'.($offsetDays === 1 ? '' : 's').' ago',
    };
@endphp
<x-mail::message :studio-name="$studioName" :logo-url="$logoUrl" :logo-height="$logoHeight ?? null">
# Payment reminder

@if ($invoice->contact)
Hi {{ $invoice->contact->name }},
@endif

This is a friendly reminder about your payment for invoice **{{ $invoice->number }}** from {{ $studioName }}.

<x-mail::panel>
**Amount due:** {{ $currency }} {{ $amount }}
**Due date:** {{ $dueDate }} ({{ $when }})
</x-mail::panel>

Thank you,<br>
{{ $studioName }}
</x-mail::message>
