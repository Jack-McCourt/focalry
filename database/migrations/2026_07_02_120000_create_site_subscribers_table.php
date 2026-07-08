<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Newsletter signups captured by the website's newsletter block. */
    public function up(): void
    {
        Schema::create('site_subscribers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('site_id')->constrained()->cascadeOnDelete();
            $table->string('email');
            $table->string('name')->nullable();
            /** The page the signup came from (for source reporting). */
            $table->string('source', 250)->nullable();
            $table->timestamps();

            $table->unique(['site_id', 'email']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_subscribers');
    }
};
