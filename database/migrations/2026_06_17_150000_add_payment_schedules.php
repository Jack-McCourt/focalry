<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            // Anchor date for auto-spacing instalments (e.g. the wedding date).
            $table->date('event_date')->nullable()->after('due_date');
            // Enabled reminder offsets in days relative to each due date, e.g. [-7,-3,0,3,7].
            $table->json('reminder_offsets')->nullable()->after('notes');
            // Keys of reminders already sent, so the daily job is idempotent.
            $table->json('reminders_sent')->nullable()->after('reminder_offsets');
        });

        Schema::create('payment_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position')->default(0);
            $table->unsignedBigInteger('amount_cents')->default(0);
            $table->date('due_date')->nullable();
            $table->timestamps();

            $table->index(['invoice_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_schedules');

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['event_date', 'reminder_offsets', 'reminders_sent']);
        });
    }
};
