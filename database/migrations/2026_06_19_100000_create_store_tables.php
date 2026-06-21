<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A catalogue of products assigned to collections to determine what's for sale.
        Schema::create('price_sheets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->boolean('is_default')->default(false);
            $table->string('fulfilment')->default('self');   // auto (lab) | self
            $table->string('currency', 3)->default('gbp');
            $table->timestamps();

            $table->index(['studio_id', 'is_default']);
        });

        Schema::create('product_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('price_sheet_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('price_sheet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('product_categories')->nullOnDelete();
            $table->string('type')->default('print');        // print | digital | package | self
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('image_path')->nullable();
            $table->string('digital_resolution')->nullable(); // for digital: web | high | original
            $table->boolean('active')->default(true);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['price_sheet_id', 'active']);
        });

        // Per-option pricing (size/finish). cogs_cents = lab cost-of-goods (for the ledger).
        Schema::create('product_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedBigInteger('price_cents')->default(0);
            $table->unsignedBigInteger('cogs_cents')->nullable();
            $table->boolean('active')->default(true);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('code');
            $table->string('type')->default('percent');       // percent | fixed | free_shipping | free_giveaway
            $table->unsignedInteger('value')->default(0);      // percent: 1-100, fixed: minor units
            $table->string('currency', 3)->default('gbp');
            $table->unsignedBigInteger('min_subtotal_cents')->nullable();
            $table->unsignedInteger('max_redemptions')->nullable();
            $table->unsignedInteger('redeemed_count')->default(0);
            $table->boolean('active')->default(true);
            $table->boolean('show_banner')->default(false);
            $table->string('banner_text')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->unique(['studio_id', 'code']);
        });

        Schema::create('gift_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('code');
            $table->unsignedBigInteger('initial_cents');
            $table->unsignedBigInteger('balance_cents');
            $table->string('currency', 3)->default('gbp');
            $table->string('recipient_email')->nullable();
            $table->text('note')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->unique(['studio_id', 'code']);
        });

        // Append-only ledger for gift-card / print-credit balance changes.
        Schema::create('credit_ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('gift_card_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('order_id')->nullable()->index();
            $table->bigInteger('delta_cents');                 // signed: +issue, -redeem
            $table->bigInteger('balance_after_cents');
            $table->string('reason');
            $table->timestamps();
        });

        Schema::create('tax_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('rate_bps')->default(0);   // basis points: 8.75% => 875
            $table->string('region')->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('shipping_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedBigInteger('price_cents')->default(0);
            $table->boolean('is_pickup')->default(false);
            $table->boolean('active')->default(true);
            $table->unsignedInteger('position')->default(0);
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('collection_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('price_sheet_id')->nullable();
            $table->foreignId('visitor_id')->nullable()->constrained('gallery_visitors')->nullOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('public_id')->unique();
            $table->string('number')->nullable();              // human-friendly order number

            $table->string('customer_name');
            $table->string('customer_email');
            $table->string('customer_phone')->nullable();

            // Shipping address (nullable — digital-only / pickup orders need none)
            $table->string('shipping_name')->nullable();
            $table->string('shipping_line1')->nullable();
            $table->string('shipping_line2')->nullable();
            $table->string('shipping_city')->nullable();
            $table->string('shipping_region')->nullable();
            $table->string('shipping_postal_code')->nullable();
            $table->string('shipping_country')->nullable();

            $table->foreignId('shipping_method_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('coupon_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('gift_card_id')->nullable()->constrained()->nullOnDelete();

            $table->string('status')->default('pending');      // pending|paid|in_production|shipped|completed|cancelled|refunded
            $table->string('fulfilment')->default('self');     // auto|self|digital|mixed
            $table->timestamp('fulfil_after')->nullable();     // review window before fulfilment
            $table->timestamp('fulfilled_at')->nullable();
            $table->timestamp('digital_delivered_at')->nullable();

            $table->string('currency', 3)->default('gbp');
            $table->unsignedBigInteger('subtotal_cents')->default(0);
            $table->unsignedBigInteger('discount_cents')->default(0);
            $table->unsignedBigInteger('gift_card_cents')->default(0);
            $table->unsignedBigInteger('tax_cents')->default(0);
            $table->unsignedBigInteger('shipping_cents')->default(0);
            $table->unsignedBigInteger('total_cents')->default(0);

            // Per-order ledger
            $table->unsignedBigInteger('platform_fee_cents')->default(0);
            $table->unsignedBigInteger('cogs_cents')->default(0);
            $table->bigInteger('payout_cents')->default(0);
            $table->unsignedBigInteger('refunded_cents')->default(0);

            $table->string('payment_method')->default('stripe'); // stripe | offline
            $table->string('stripe_session_id')->nullable();
            $table->string('stripe_payment_intent')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['studio_id', 'status']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('option_id')->nullable()->constrained('product_options')->nullOnDelete();
            $table->foreignId('photo_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type')->default('print');          // print|digital|package|self
            $table->string('description');                      // snapshot: "8x10 Glossy — Print"
            $table->unsignedInteger('qty')->default(1);
            $table->unsignedBigInteger('unit_price_cents')->default(0);
            $table->unsignedBigInteger('cogs_cents')->default(0); // per-unit lab cost
            $table->unsignedBigInteger('line_total_cents')->default(0);
            $table->string('fulfilment')->default('self');     // auto|self|digital
            $table->string('digital_resolution')->nullable();
            $table->string('download_token')->nullable()->index();
            $table->unsignedInteger('download_count')->default(0);
            $table->timestamps();
        });

        Schema::create('order_refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('amount_cents');
            $table->text('reason')->nullable();
            $table->string('stripe_refund_id')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_refunds');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('shipping_methods');
        Schema::dropIfExists('tax_rates');
        Schema::dropIfExists('credit_ledger_entries');
        Schema::dropIfExists('gift_cards');
        Schema::dropIfExists('coupons');
        Schema::dropIfExists('product_options');
        Schema::dropIfExists('products');
        Schema::dropIfExists('product_categories');
        Schema::dropIfExists('price_sheets');
    }
};
