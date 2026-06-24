<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets a studio "tag" an individual message to one of the client's projects, so
 * it surfaces inside that project's drawer. Nulled (not deleted) if the project
 * goes away — the message itself lives on in its conversation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->after('conversation_id')
                ->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('project_id');
        });
    }
};
