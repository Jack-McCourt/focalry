<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contract_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->longText('body')->nullable();   // HTML
            $table->json('fields')->nullable();      // default fillable-field definitions
            $table->timestamps();

            $table->index('studio_id');
        });

        Schema::create('contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('public_id')->unique();
            $table->string('title');
            $table->longText('body')->nullable();    // HTML with {{merge}} placeholders
            $table->json('fields')->nullable();       // [{key,label,type,fill_by,value}]
            $table->string('status')->default('draft'); // draft|sent|signed|declined|void
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('signed_at')->nullable();
            $table->timestamps();

            $table->index(['studio_id', 'status']);
        });

        Schema::create('contract_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained()->cascadeOnDelete();
            $table->string('role'); // studio | client
            $table->string('signer_name');
            $table->string('signature_type')->default('typed'); // typed | drawn
            $table->longText('signature_data')->nullable(); // typed name or PNG data URL
            $table->timestamp('signed_at');
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->unique(['contract_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_signatures');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('contract_templates');
    }
};
