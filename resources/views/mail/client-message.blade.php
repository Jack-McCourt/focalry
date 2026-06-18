<x-mail::message>
# {{ $studioName }}

{!! nl2br(e($bodyText)) !!}

<x-mail::button :url="$ctaUrl">
{{ $ctaLabel }}
</x-mail::button>

@if (! empty($details))
<x-mail::panel>
@foreach ($details as $d)
**{{ $d['label'] }}:** {{ $d['value'] }}@if (! $loop->last)<br>@endif
@endforeach
</x-mail::panel>
@endif

<small>If the button above doesn’t work, copy and paste this link into your browser:<br>{{ $ctaUrl }}</small>
</x-mail::message>
