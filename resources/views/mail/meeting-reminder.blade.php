<x-mail::message :studio-name="$studioName" :logo-url="$logoUrl" :logo-height="$logoHeight ?? null">
# Your meeting is coming up

Hi {{ \Illuminate\Support\Str::of($meeting->client_name)->before(' ') }},

This is a friendly reminder of your upcoming **{{ $meetingName }}** with {{ $studioName }}.

**When:** {{ $meeting->starts_at->timezone(config('app.timezone'))->format('l, F j, Y') }}
at {{ $meeting->starts_at->timezone(config('app.timezone'))->format('g:i A') }}
@if ($meeting->location)

**Where:** {{ $meeting->location }}
@endif

@if ($meeting->meeting_url)
@component('mail::button', ['url' => $meeting->meeting_url])
Join the video call
@endcomponent
@endif

See you then!

— {{ $studioName }}
</x-mail::message>
