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
    }

    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // Studio is the Cashier billable entity, not User.
        Cashier::useCustomerModel(Studio::class);

        // We register the webhook route manually in routes/api.php.
        Cashier::ignoreRoutes();

        Model::shouldBeStrict(! app()->isProduction());
    }
}
