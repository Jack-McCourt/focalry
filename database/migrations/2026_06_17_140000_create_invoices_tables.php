<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->string('number');
            // draft → sent → partial → paid ; or void
            $table->string('status')->default('draft');
            $table->string('currency', 3)->default('usd');
            $table->date('issue_date')->nullable();
            $table->date('due_date')->nullable();
            // All money in integer minor units (cents). Stripe is source of truth for paid amounts.
            $table->unsignedBigInteger('subtotal_cents')->default(0);
            $table->unsignedBigInteger('discount_cents')->default(0);
            $table->decimal('tax_rate', 5, 2)->default(0); // percent, e.g. 8.50
            $table->unsignedBigInteger('tax_cents')->default(0);
            $table->unsignedBigInteger('total_cents')->default(0);
            $table->unsignedBigInteger('amount_paid_cents')->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->unique(['studio_id', 'number']);
            $table->index(['studio_id', 'status']);
        });

        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->string('description');
            $table->decimal('quantity', 8, 2)->default(1);
            $table->unsignedBigInteger('unit_amount_cents')->default(0);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['invoice_id', 'position']);
        });

        // Offline + (future) Stripe payments recorded against an invoice.
        Schema::create('invoice_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('amount_cents');
            $table->string('method')->default('manual'); // manual | stripe
            $table->string('reference')->nullable();      // cheque #, Stripe payment intent, etc.
            $table->date('paid_on')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_payments');
        Schema::dropIfExists('invoice_items');
        Schema::dropIfExists('invoices');
    }
};
