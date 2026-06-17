<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->uuid('public_id')->nullable()->unique()->after('number');
        });

        // Backfill any existing invoices with an unguessable public pay-link token.
        DB::table('invoices')->whereNull('public_id')->orderBy('id')->each(function ($row) {
            DB::table('invoices')->where('id', $row->id)->update(['public_id' => (string) Str::uuid()]);
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('public_id');
        });
    }
};
