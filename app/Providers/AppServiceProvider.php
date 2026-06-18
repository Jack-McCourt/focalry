<?php

namespace App\Providers;

use App\Models\Studio;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Laravel\Cashier\Cashier;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Bind a null current studio ID by default; SetCurrentStudio middleware overwrites this.
        $this->app->bind('current.studio.id', fn () => null);

        // We register the webhook route manually in routes/api.php. This must run in
        // register() — by boot() time Cashier's provider has already registered its
        // default /stripe/webhook route (which lacks our checkout.session handler).
        Cashier::ignoreRoutes();
    }

    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // Studio is the Cashier billable entity, not User.
        Cashier::useCustomerModel(Studio::class);

        Model::shouldBeStrict(! app()->isProduction());
    }
}
