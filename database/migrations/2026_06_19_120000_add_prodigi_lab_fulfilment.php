<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A product backed by the Prodigi catalogue (lab-fulfilled). Null = self/digital.
        Schema::table('products', function (Blueprint $table) {
            $table->string('lab_product_key')->nullable()->after('type');
        });

        // The Prodigi SKU ordered for this option (size/finish). Null = self-fulfilled option.
        Schema::table('product_options', function (Blueprint $table) {
            $table->string('lab_sku')->nullable()->after('product_id');
        });

        // Prodigi order reference + shipment tracking from status callbacks.
        Schema::table('orders', function (Blueprint $table) {
            $table->string('lab_order_ref')->nullable()->after('stripe_payment_intent');
            $table->string('shipping_carrier')->nullable()->after('lab_order_ref');
            $table->string('tracking_number')->nullable()->after('shipping_carrier');
            $table->string('tracking_url')->nullable()->after('tracking_number');
            $table->index('lab_order_ref');
        });
    }

    public function down(): void
    {
        Schema::table('products', fn (Blueprint $t) => $t->dropColumn('lab_product_key'));
        Schema::table('product_options', fn (Blueprint $t) => $t->dropColumn('lab_sku'));
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['lab_order_ref']);
            $table->dropColumn(['lab_order_ref', 'shipping_carrier', 'tracking_number', 'tracking_url']);
        });
    }
};
