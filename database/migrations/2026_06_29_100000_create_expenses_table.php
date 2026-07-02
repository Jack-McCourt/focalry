<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            // Optionally attribute the cost to a job, for per-project profitability.
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->date('spent_on');
            $table->string('category');
            $table->string('vendor')->nullable();
            $table->string('description')->nullable();
            $table->unsignedBigInteger('amount_cents')->default(0);
            $table->string('currency', 3)->default('gbp');
            // Private Wasabi key for the receipt (outside the public/ prefix).
            $table->string('receipt_path')->nullable();
            // Whether this cost is to be rebilled to the client.
            $table->boolean('billable')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['studio_id', 'spent_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
