<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Flexible ("pay what you want" / tip-jar) payment links: the customer chooses
 * the amount, optionally above a minimum, with a suggested default.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->string('pricing_type')->default('fixed')->after('price_cents'); // fixed | flexible
            $table->unsignedBigInteger('min_amount_cents')->nullable()->after('pricing_type');
            $table->unsignedBigInteger('suggested_amount_cents')->nullable()->after('min_amount_cents');
        });
    }

    public function down(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->dropColumn(['pricing_type', 'min_amount_cents', 'suggested_amount_cents']);
        });
    }
};
