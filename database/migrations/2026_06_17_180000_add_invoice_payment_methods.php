<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Studio-level invoice defaults: offered payment methods, bank details, terms, tax.
        Schema::table('studios', function (Blueprint $table) {
            $table->json('invoice_settings')->nullable()->after('default_currency');
        });

        // Which payment methods this specific invoice offers (overrides the default).
        Schema::table('invoices', function (Blueprint $table) {
            $table->json('payment_methods')->nullable()->after('tax_rate');
        });
    }

    public function down(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            $table->dropColumn('invoice_settings');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('payment_methods');
        });
    }
};
