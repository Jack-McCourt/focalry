<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_portal_accesses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            // One portal per contact — every project/document for that client
            // is aggregated behind the single token.
            $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
            $table->string('token', 64)->unique();
            // Persistent (reusable) 6-digit access code, emailed to the contact.
            $table->string('code', 6);
            $table->timestamp('last_viewed_at')->nullable();
            $table->timestamps();

            $table->unique('contact_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_portal_accesses');
    }
};
