<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('session_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->unsignedInteger('duration_minutes')->default(60);
            $table->unsignedBigInteger('price_cents')->default(0);
            $table->string('currency', 3)->default('usd');
            $table->string('location_type')->default('in_person'); // in_person | phone | video
            $table->string('location')->nullable();
            $table->string('color')->nullable();
            $table->unsignedInteger('buffer_minutes')->default(0);
            $table->unsignedInteger('min_lead_hours')->default(24);
            $table->unsignedInteger('max_per_day')->nullable();
            $table->boolean('manual_approve')->default(false);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['studio_id', 'slug']);
        });

        Schema::create('availability_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('day_of_week'); // 0 = Sunday … 6 = Saturday
            $table->time('start_time');
            $table->time('end_time');
            $table->timestamps();

            $table->index(['studio_id', 'day_of_week']);
        });

        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('session_type_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('public_id')->unique();
            $table->string('client_name');
            $table->string('client_email');
            $table->string('client_phone')->nullable();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('status')->default('pending'); // pending|confirmed|declined|cancelled|completed
            $table->unsignedBigInteger('price_cents')->default(0);
            $table->string('currency', 3)->default('usd');
            $table->string('location')->nullable();
            $table->text('notes')->nullable();
            $table->string('meeting_url')->nullable();        // video-call link (Phase B)
            $table->string('google_event_id')->nullable();    // calendar sync (Phase B)
            $table->json('reminders_sent')->nullable();        // reminder idempotency (Phase C)
            $table->timestamps();

            $table->index(['studio_id', 'starts_at']);
            $table->index(['studio_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
        Schema::dropIfExists('availability_rules');
        Schema::dropIfExists('session_types');
    }
};
