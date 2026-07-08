<x-mail::message :studio-name="$forStudio ? config('app.name') : $studioName" :logo-url="$forStudio ? null : $logoUrl" :logo-height="$forStudio ? null : ($logoHeight ?? null)">
@if ($forStudio)
# New booking confirmed

You have a new **{{ $meetingName }}** booking.

**Who:** {{ $meeting->client_name }} ({{ $meeting->client_email }})
@if ($meeting->client_phone)

**Phone:** {{ $meeting->client_phone }}
@endif
@else
# Your booking is confirmed

Hi {{ \Illuminate\Support\Str::of($meeting->client_name)->before(' ') }},

Your **{{ $meetingName }}** with {{ $studioName }} is confirmed.
@endif

**When:** {{ $meeting->starts_at->timezone($timezone)->format('l, F j, Y') }}
at {{ $meeting->starts_at->timezone($timezone)->format('g:i A') }} ({{ $timezone }})
@if ($meeting->location)

**Where:** {{ $meeting->location }}
@endif
@if ($forStudio && $meeting->notes)

**Notes:** {{ $meeting->notes }}
@endif

@if ($meeting->meeting_url)
@component('mail::button', ['url' => $meeting->meeting_url])
Join the video call
@endcomponent

Or use this link: [{{ $meeting->meeting_url }}]({{ $meeting->meeting_url }})
@endif

@if ($forStudio)
— {{ config('app.name') }}
@else
See you then!

— {{ $studioName }}
@endif
</x-mail::message>
