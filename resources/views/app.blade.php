<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        {{-- The page title is provided by Inertia's <Head> (server-rendered via
             @inertiaHead when SSR is on, set by JS otherwise) — no static <title>
             here, so crawlers never see a duplicate/placeholder title. --}}
        <meta name="asset-cdn" content="{{ config('filesystems.disks.wasabi.cdn_url') }}">
        <link rel="preconnect" href="{{ config('filesystems.disks.wasabi.cdn_url') }}" crossorigin>

        {{-- Platform favicon. Skipped on public studio-site pages so the studio's
             own favicon (injected via Inertia <Head>) isn't out-competed by these
             — a static icon with sizes="any" otherwise wins in most browsers. --}}
        @unless(\Illuminate\Support\Str::startsWith($page['component'] ?? '', 'Sites/'))
            <link rel="icon" href="/favicon.ico" sizes="any">
            <link rel="icon" href="/images/logo/focalry-icon.png" type="image/png">
            <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        @endunless


        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/Pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
