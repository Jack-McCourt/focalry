<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Galleries belong to a project (the project owns the client relationship).
        // contact_id is kept as a denormalised mirror of the project's contact for
        // fast "this client's galleries" lookups and existing order/email flows.
        Schema::table('collections', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->after('contact_id')
                ->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('collections', function (Blueprint $table) {
            $table->dropConstrainedForeignId('project_id');
        });
    }
};
