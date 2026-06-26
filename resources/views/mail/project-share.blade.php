@component('mail::layout')
@slot('header')
@component('mail::header', ['url' => config('app.url')])
@if (!empty($logoUrl))
<img src="{{ $logoUrl }}" alt="{{ $studioName }}" style="max-height:48px;width:auto;border:0;">
@else
{{ $studioName }}
@endif
@endcomponent
@endslot

{{ $inviterName ? "$inviterName has" : "$studioName has" }} shared the details for **{{ $projectName }}** with you.

You can view the details below — it's read-only, and you can print it if you need a copy.

@component('mail::button', ['url' => $url])
View details
@endcomponent

@if (!empty($code))
You'll be asked for this access code when you open the link:

@component('mail::panel')
# {{ $code }}
@endcomponent
@endif

If the button doesn't work, copy and paste this link into your browser:
{{ $url }}

@slot('footer')
@component('mail::footer')
© {{ date('Y') }} {{ $studioName }}
@endcomponent
@endslot
@endcomponent
