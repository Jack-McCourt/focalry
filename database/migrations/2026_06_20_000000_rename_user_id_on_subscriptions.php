<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cashier's billable customer model is Studio (see AppServiceProvider), so the
 * subscriptions foreign key must be `studio_id`, not the scaffolded `user_id`.
 * No subscriptions exist yet, so renaming in place is safe.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('subscriptions', 'user_id') && ! Schema::hasColumn('subscriptions', 'studio_id')) {
            Schema::table('subscriptions', function (Blueprint $table) {
                $table->renameColumn('user_id', 'studio_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('subscriptions', 'studio_id') && ! Schema::hasColumn('subscriptions', 'user_id')) {
            Schema::table('subscriptions', function (Blueprint $table) {
                $table->renameColumn('studio_id', 'user_id');
            });
        }
    }
};
