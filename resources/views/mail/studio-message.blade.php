@component('mail::message')
{!! nl2br(e($bodyText)) !!}

<br>
— {{ $studioName }}

@slot('subcopy')
You can reply directly to this email and your message will reach {{ $studioName }}.
@endslot
@endcomponent
