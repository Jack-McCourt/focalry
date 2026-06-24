<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tracks which gallery photos a studio has recently imported through the
 * website-builder "From galleries" picker, so the picker can offer a
 * "Recently used" tab ordered by most-recent use.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gallery_recent_picks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('photo_id')->constrained()->cascadeOnDelete();
            $table->timestamp('used_at')->useCurrent();
            $table->unique(['studio_id', 'photo_id']);
            $table->index(['studio_id', 'used_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gallery_recent_picks');
    }
};
