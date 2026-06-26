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

Use this code to view **{{ $projectName }}**:

@component('mail::panel')
# {{ $code }}
@endcomponent

If you didn't request it, you can ignore this email.

@slot('footer')
@component('mail::footer')
© {{ date('Y') }} {{ $studioName }}
@endcomponent
@endslot
@endcomponent
