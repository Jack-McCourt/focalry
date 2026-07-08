@props(['studioName' => null, 'logoUrl' => null, 'logoHeight' => null])
@php
    // Customer-facing emails brand with the studio: its logo if one is set,
    // otherwise the studio name. Falls back to the platform name when neither
    // is provided (e.g. internal notifications to the photographer).
    $brandName = $studioName ?: config('app.name');
    $brandLogo = $logoUrl ?: null;
    // Logo size is a studio setting; medium (48px) is the default.
    $brandLogoHeight = (int) ($logoHeight ?: 48);
@endphp
<x-mail::layout>
{{-- Header --}}
<x-slot:header>
<x-mail::header :url="config('app.url')">
@if ($brandLogo)
<img src="{{ $brandLogo }}" alt="{{ $brandName }}" style="max-height:{{ $brandLogoHeight }}px;width:auto;border:0;">
@else
{{ $brandName }}
@endif
</x-mail::header>
</x-slot:header>

{{-- Body --}}
{!! $slot !!}

{{-- Subcopy --}}
@isset($subcopy)
<x-slot:subcopy>
<x-mail::subcopy>
{!! $subcopy !!}
</x-mail::subcopy>
</x-slot:subcopy>
@endisset

{{-- Footer --}}
<x-slot:footer>
<x-mail::footer>
© {{ date('Y') }} {{ $brandName }}
</x-mail::footer>
</x-slot:footer>
</x-mail::layout>
