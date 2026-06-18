@component('mail::message')
{!! \Illuminate\Support\Str::markdown($bodyText, ['html_input' => 'escape', 'allow_unsafe_links' => false]) !!}

@if (!empty($signature))
<br>
{!! \Illuminate\Support\Str::markdown($signature, ['html_input' => 'escape', 'allow_unsafe_links' => false]) !!}
@else
<br>
— {{ $studioName }}
@endif

@slot('subcopy')
You can reply directly to this email and your message will reach {{ $studioName }}.
@endslot
@endcomponent
@if (!empty($trackingUrl))
<img src="{{ $trackingUrl }}" alt="" width="1" height="1" style="display:none">
@endif
