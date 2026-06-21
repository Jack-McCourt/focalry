<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->text('details')->nullable();          // what's included
            $table->string('image_path')->nullable();
            $table->unsignedBigInteger('price_cents')->default(0);
            $table->unsignedBigInteger('deposit_cents')->nullable(); // null = full payment only
            $table->string('currency', 3)->default('gbp');
            $table->boolean('active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['studio_id', 'slug']);
        });

        Schema::create('package_bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('package_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('public_id')->unique();
            $table->string('client_name');
            $table->string('client_email');
            $table->string('client_phone')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('amount_cents')->default(0); // what was charged
            $table->string('payment_type')->default('full');        // full | deposit
            $table->string('currency', 3)->default('gbp');
            $table->string('status')->default('pending');            // pending | paid | cancelled
            $table->string('stripe_session_id')->nullable();
            $table->string('stripe_payment_intent')->nullable();
            $table->timestamps();

            $table->index(['studio_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('package_bookings');
        Schema::dropIfExists('packages');
    }
};
