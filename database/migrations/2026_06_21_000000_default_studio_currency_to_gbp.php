<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * UK-oriented product: new studios should default to GBP, not USD. Only the
 * column default changes — existing studios keep their chosen currency.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            $table->string('default_currency', 3)->default('gbp')->change();
        });
    }

    public function down(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            $table->string('default_currency', 3)->default('usd')->change();
        });
    }
};
