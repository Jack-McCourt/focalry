@component('mail::message')
# Your session is coming up

Hi {{ \Illuminate\Support\Str::of($booking->client_name)->before(' ') }},

This is a friendly reminder of your upcoming **{{ $sessionName }}** with {{ $studioName }}.

**When:** {{ $booking->starts_at->timezone(config('app.timezone'))->format('l, F j, Y') }}
at {{ $booking->starts_at->timezone(config('app.timezone'))->format('g:i A') }}
@if ($booking->location)

**Where:** {{ $booking->location }}
@endif

@if ($booking->meeting_url)
@component('mail::button', ['url' => $booking->meeting_url])
Join the video call
@endcomponent
@endif

We look forward to seeing you!

— {{ $studioName }}
@endcomponent
