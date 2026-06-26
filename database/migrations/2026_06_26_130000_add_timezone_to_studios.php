<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            // IANA timezone the studio operates in. Meeting availability windows
            // and generated slots are computed in this zone so "9am" means 9am
            // local, not 9am UTC. Defaults to UK time (the platform's home).
            $table->string('timezone')->default('Europe/London')->after('default_currency');
        });
    }

    public function down(): void
    {
        Schema::table('studios', function (Blueprint $table) {
            $table->dropColumn('timezone');
        });
    }
};
