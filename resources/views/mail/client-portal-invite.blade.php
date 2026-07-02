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

Hi {{ $clientName }},

{{ $studioName }} has set up a private portal where you can find everything for your work together in one place — galleries, invoices, contracts, questionnaires and upcoming sessions.

@component('mail::button', ['url' => $url])
Open your portal
@endcomponent

When you open it, enter this access code:

@component('mail::panel')
# {{ $code }}
@endcomponent

Keep this email — you can use the same link and code whenever you need to come back.

@slot('footer')
@component('mail::footer')
© {{ date('Y') }} {{ $studioName }}
@endcomponent
@endslot
@endcomponent
