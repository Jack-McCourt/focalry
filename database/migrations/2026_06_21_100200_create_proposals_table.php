<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A single client-facing offer that bundles an optional package summary,
        // a contract to sign and an invoice deposit to pay.
        Schema::create('proposals', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('package_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('contract_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            // draft → sent → accepted → declined
            $table->string('status')->default('draft');
            $table->text('intro')->nullable();
            $table->boolean('require_signature')->default(true);
            $table->boolean('require_deposit')->default(true);
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('declined_at')->nullable();
            $table->timestamps();

            $table->index(['studio_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proposals');
    }
};
