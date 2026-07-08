<x-mail::message>
# New message from {{ $fromName }}

**Re: {{ $subject }}**

@component('mail::panel')
{!! \Illuminate\Support\Str::markdown($body, ['html_input' => 'escape', 'allow_unsafe_links' => false, 'renderer' => ['soft_break' => "<br>\n"]]) !!}
@endcomponent

@component('mail::button', ['url' => $url])
View conversation
@endcomponent

Reply right here in your studio messages.
</x-mail::message>
