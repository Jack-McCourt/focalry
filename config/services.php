<?php

use App\Models\Studio;

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    // Two-way client messaging. `inbound_address` is the Postmark inbound address
    // (a +token mailbox-hash routes a reply to its conversation); `inbound_secret`
    // is the path segment that protects the inbound webhook.
    'messaging' => [
        'inbound_address' => env('MESSAGING_INBOUND_ADDRESS'),
        'inbound_secret' => env('MESSAGING_INBOUND_SECRET'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // AI assists in the website builder (alt text, SEO copy, headlines).
    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'model' => env('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001'),
    ],

    // Cloudflare Turnstile (optional contact-form captcha).
    'turnstile' => [
        'site_key' => env('TURNSTILE_SITE_KEY'),
        'secret_key' => env('TURNSTILE_SECRET_KEY'),
    ],

    // Instagram feed block (Instagram API with Instagram Login — business/creator
    // accounts). Register an app at developers.facebook.com, add the redirect URI
    // {APP_URL}/website/instagram/callback, then set these:
    'instagram' => [
        'client_id' => env('INSTAGRAM_CLIENT_ID'),
        'client_secret' => env('INSTAGRAM_CLIENT_SECRET'),
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI', '/auth/google/callback'),
        // Server-side key (Places API enabled) used to pull Google reviews into
        // the website builder's Google Reviews block.
        'places_key' => env('GOOGLE_PLACES_API_KEY'),
    ],

    'stripe' => [
        'model' => Studio::class,
        'key' => env('STRIPE_KEY'),
        'secret' => env('STRIPE_SECRET'),
        'webhook' => [
            'secret' => env('STRIPE_WEBHOOK_SECRET'),
            'tolerance' => env('STRIPE_WEBHOOK_TOLERANCE', 300),
        ],
        'connect_client_id' => env('STRIPE_CONNECT_CLIENT_ID'),
    ],

    // Prodigi — the print-lab partner for "lab" (auto) fulfilment.
    'prodigi' => [
        'key' => env('PRODIGI_API_KEY'),
        'sandbox' => env('PRODIGI_SANDBOX', true),
        'shipping_method' => env('PRODIGI_SHIPPING_METHOD', 'Standard'),
        // Shared secret embedded in the per-order callback URL to authenticate Prodigi's webhooks.
        'callback_secret' => env('PRODIGI_CALLBACK_SECRET'),
    ],

    'zoom' => [
        'client_id' => env('ZOOM_CLIENT_ID'),
        'client_secret' => env('ZOOM_CLIENT_SECRET'),
    ],

    // Targets shown to studios when connecting a custom domain. `target` is the
    // CNAME host (for www/subdomains); `ip` is the A record (for apex domains).
    'custom_domains' => [
        'target' => env('CUSTOM_DOMAIN_TARGET', parse_url((string) env('APP_URL'), PHP_URL_HOST)),
        'ip' => env('CUSTOM_DOMAIN_IP'),
    ],

];
