<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Server Side Rendering
    |--------------------------------------------------------------------------
    |
    | These settings control whether Inertia renders the page on the server via
    | the Node SSR process (so crawlers/social scrapers get full HTML), and the
    | address that process listens on. Start it with:
    |
    |   php artisan inertia:start-ssr
    |
    | The bundle is produced by `npm run build` (vite build --ssr) at
    | bootstrap/ssr/ssr.js.
    |
    */

    'ssr' => [
        'enabled' => env('INERTIA_SSR_ENABLED', true),
        'url' => env('INERTIA_SSR_URL', 'http://127.0.0.1:13714'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Testing
    |--------------------------------------------------------------------------
    */

    'testing' => [
        'ensure_pages_exist' => true,
        'page_paths' => [
            resource_path('js/Pages'),
        ],
        'page_extensions' => [
            'js',
            'jsx',
            'ts',
            'tsx',
            'vue',
        ],
    ],

];
