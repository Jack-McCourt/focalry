<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // the admin who acted
            $table->string('action');                 // e.g. studio.update, impersonate.start
            $table->string('target_type')->nullable(); // model class
            $table->unsignedBigInteger('target_id')->nullable();
            $table->string('description')->nullable(); // human-readable summary
            $table->json('meta')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamps();

            $table->index(['target_type', 'target_id']);
            $table->index('action');
        });

        Schema::table('studios', function (Blueprint $table) {
            // Super-admin override of the plan's storage cap, in bytes.
            // Null = use the plan's included storage.
            $table->unsignedBigInteger('storage_limit_override')->nullable()->after('storage_used');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_audit_logs');

        Schema::table('studios', function (Blueprint $table) {
            $table->dropColumn('storage_limit_override');
        });
    }
};
