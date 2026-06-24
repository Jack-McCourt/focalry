@component('mail::layout')
{{-- Header: the studio's logo if set, otherwise the studio name. --}}
@slot('header')
@component('mail::header', ['url' => config('app.url')])
@if (!empty($logoUrl))
<img src="{{ $logoUrl }}" alt="{{ $studioName }}" style="max-height:48px;width:auto;border:0;">
@else
{{ $studioName }}
@endif
@endcomponent
@endslot

{!! $bodyHtml !!}

@if (!empty($signatureHtml))
<br>
{!! $signatureHtml !!}
@else
<br>
— {{ $studioName }}
@endif

{{-- Subcopy --}}
@slot('subcopy')
@component('mail::subcopy')
You can reply directly to this email and your message will reach {{ $studioName }}.
@endcomponent
@endslot

{{-- Footer --}}
@slot('footer')
@component('mail::footer')
© {{ date('Y') }} {{ $studioName }}
@endcomponent
@endslot
@endcomponent
@if (!empty($trackingUrl))
<img src="{{ $trackingUrl }}" alt="" width="1" height="1" style="display:none">
@endif
