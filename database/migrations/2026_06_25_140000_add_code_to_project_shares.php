<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_shares', function (Blueprint $table) {
            $table->string('code', 6)->nullable()->after('token');
        });

        // Give existing shares a stable access code.
        foreach (DB::table('project_shares')->whereNull('code')->pluck('id') as $id) {
            DB::table('project_shares')->where('id', $id)->update(['code' => (string) random_int(100000, 999999)]);
        }
    }

    public function down(): void
    {
        Schema::table('project_shares', function (Blueprint $table) {
            $table->dropColumn('code');
        });
    }
};
