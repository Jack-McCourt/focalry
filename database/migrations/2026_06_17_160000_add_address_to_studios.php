<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            $table->string('address_line1')->nullable()->after('email');
            $table->string('address_line2')->nullable()->after('address_line1');
            $table->string('city')->nullable()->after('address_line2');
            $table->string('region')->nullable()->after('city'); // state / province
            $table->string('postal_code')->nullable()->after('region');
            $table->string('country', 2)->nullable()->after('postal_code'); // ISO 3166-1 alpha-2
        });
    }

    public function down(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            $table->dropColumn(['address_line1', 'address_line2', 'city', 'region', 'postal_code', 'country']);
        });
    }
};
