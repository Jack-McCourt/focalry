<?php

/*
|--------------------------------------------------------------------------
| Subscription Plans (Pixieset-style tiers)
|--------------------------------------------------------------------------
|
| These are the platform's own subscription tiers that a Studio (the
| photographer's account) pays for in order to use the app. Each tier
| unlocks more storage and more areas of the product.
|
| Source of truth for what a studio is *currently* on is the active Cashier
| subscription; the `studios.plan` column caches the resolved key and is
| kept in sync from Stripe webhooks (see Studio::syncPlanFromSubscription()).
|
| Prices below are the monthly price shown to the user (in minor units /
| cents). Annual billing is the equivalent of 10 months (2 months free).
| The actual amounts charged come from Stripe Price objects — set their IDs
| via the STRIPE_PRICE_* env vars so test/live can differ.
|
| `storage` is the included storage cap in BYTES. `null` means unlimited.
| `features` is the set of product areas the tier unlocks (cumulative).
|
*/

$GB = 1024 ** 3;
$TB = 1024 ** 4;

return [

    // Billing currency for the platform subscription (prices below are in this
    // currency's minor units). The wider app uses each studio's own currency.
    'currency' => 'gbp',

    // The order tiers appear on the pricing page, cheapest first.
    'order' => ['free', 'lite', 'basic', 'plus', 'ultimate'],

    'tiers' => [

        'free' => [
            'name' => 'Free',
            'tagline' => 'Get started with client galleries.',
            'price' => 0,
            'storage' => 3 * $GB,
            'commission_rate' => 15,
            'features' => ['galleries'],
            'stripe' => ['monthly' => null, 'yearly' => null],
        ],

        'lite' => [
            'name' => 'Lite',
            'tagline' => 'Sell prints & digitals, commission-free.',
            'price' => 800,
            'storage' => 100 * $GB,
            'commission_rate' => 0,
            'features' => ['galleries', 'store'],
            'stripe' => [
                'monthly' => env('STRIPE_PRICE_LITE_MONTHLY'),
                'yearly' => env('STRIPE_PRICE_LITE_YEARLY'),
            ],
        ],

        'basic' => [
            'name' => 'Basic',
            'tagline' => 'Run your business with the Studio Manager.',
            'price' => 1600,
            'storage' => 1 * $TB,
            'commission_rate' => 0,
            'features' => ['galleries', 'store', 'studio_manager'],
            'stripe' => [
                'monthly' => env('STRIPE_PRICE_BASIC_MONTHLY'),
                'yearly' => env('STRIPE_PRICE_BASIC_YEARLY'),
            ],
        ],

        'plus' => [
            'name' => 'Plus',
            'tagline' => '2 TB storage and your own website.',
            'price' => 2400,
            'storage' => 2 * $TB,
            'commission_rate' => 0,
            'features' => ['galleries', 'store', 'studio_manager', 'website'],
            'stripe' => [
                'monthly' => env('STRIPE_PRICE_PLUS_MONTHLY'),
                'yearly' => env('STRIPE_PRICE_PLUS_YEARLY'),
            ],
        ],

        'ultimate' => [
            'name' => 'Ultimate',
            'tagline' => 'Unlimited storage, custom domain — everything.',
            'price' => 4000,
            'storage' => null, // unlimited
            'commission_rate' => 0,
            'features' => ['galleries', 'store', 'studio_manager', 'website', 'custom_domain'],
            'stripe' => [
                'monthly' => env('STRIPE_PRICE_ULTIMATE_MONTHLY'),
                'yearly' => env('STRIPE_PRICE_ULTIMATE_YEARLY'),
            ],
        ],

    ],

    /*
    | Human-readable labels for the feature keys, used on the pricing page
    | and in "upgrade required" messaging.
    */
    'feature_labels' => [
        'galleries' => 'Client Galleries',
        'store' => 'Store & Print Sales',
        'studio_manager' => 'Studio Manager (CRM)',
        'website' => 'Website Builder',
        'custom_domain' => 'Custom Domain',
    ],
];
