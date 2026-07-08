<x-mail::message :studio-name="$studioName" :logo-url="$logoUrl" :logo-height="$logoHeight ?? null">
{!! nl2br(e($bodyText)) !!}

@if (! empty($ctaUrl) && ! empty($ctaLabel))
<x-mail::button :url="$ctaUrl">
{{ $ctaLabel }}
</x-mail::button>

<small>If the button above doesn’t work, copy and paste this link into your browser:<br>{{ $ctaUrl }}</small>
@endif
</x-mail::message>
