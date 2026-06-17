<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('collections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('contact_id')->nullable()->index();
            $table->string('title');
            $table->string('slug')->unique();
            $table->date('event_date')->nullable();
            $table->unsignedBigInteger('cover_photo_id')->nullable()->index();
            $table->json('cover_style')->nullable();
            $table->json('privacy')->nullable();
            $table->json('download_settings')->nullable();
            $table->json('favourite_settings')->nullable();
            $table->unsignedBigInteger('price_sheet_id')->nullable()->index();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->string('status')->default('draft');
            $table->boolean('starred')->default(false);
            $table->timestamps();

            $table->index(['studio_id', 'status']);
        });

        Schema::create('sets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('collection_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('position')->default(0);
            $table->boolean('visible')->default(true);
            $table->timestamps();

            $table->index(['collection_id', 'position']);
        });

        Schema::create('photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('collection_id')->constrained()->cascadeOnDelete();
            $table->foreignId('set_id')->nullable()->constrained()->nullOnDelete();
            $table->string('filename');
            $table->string('wasabi_key_original');
            $table->json('derivative_keys')->nullable();
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->timestamp('exif_taken_at')->nullable();
            $table->string('status')->default('processing');
            $table->unsignedInteger('position')->default(0);
            $table->boolean('starred')->default(false);
            $table->timestamps();

            $table->index(['collection_id', 'status']);
            $table->index(['collection_id', 'set_id', 'position']);
        });

        Schema::create('videos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('collection_id')->constrained()->cascadeOnDelete();
            $table->foreignId('set_id')->nullable()->constrained()->nullOnDelete();
            $table->string('filename');
            $table->string('wasabi_key');
            $table->string('thumbnail_key')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('status')->default('processing');
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['collection_id', 'status']);
        });

        Schema::create('gallery_visitors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('collection_id')->constrained()->cascadeOnDelete();
            $table->string('email')->nullable();
            $table->string('name')->nullable();
            $table->string('token')->unique();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->index(['collection_id', 'email']);
        });

        Schema::create('favourite_lists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('collection_id')->constrained()->cascadeOnDelete();
            $table->foreignId('visitor_id')->nullable()->constrained('gallery_visitors')->nullOnDelete();
            $table->string('name')->default('My Favourites');
            $table->unsignedInteger('selection_limit')->nullable();
            $table->timestamps();
        });

        Schema::create('favourites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('list_id')->constrained('favourite_lists')->cascadeOnDelete();
            $table->foreignId('photo_id')->constrained()->cascadeOnDelete();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->unique(['list_id', 'photo_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('favourites');
        Schema::dropIfExists('favourite_lists');
        Schema::dropIfExists('gallery_visitors');
        Schema::dropIfExists('videos');
        Schema::dropIfExists('photos');
        Schema::dropIfExists('sets');
        Schema::dropIfExists('collections');
    }
};
