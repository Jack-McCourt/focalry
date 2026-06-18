<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Standard Laravel database notifications (bell dropdown).
        if (! Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('type');
                $table->morphs('notifiable');
                $table->text('data');
                $table->timestamp('read_at')->nullable();
                $table->timestamps();
            });
        }

        Schema::table('messages', function (Blueprint $table) {
            // Internal notes live in the thread but are never emailed.
            $table->boolean('is_internal')->default(false)->after('direction');
            // Read receipt for outbound email (set by the open-tracking pixel).
            $table->timestamp('opened_at')->nullable()->after('status');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->json('tags')->nullable()->after('status');
        });

        Schema::table('studios', function (Blueprint $table) {
            $table->text('email_signature')->nullable()->after('invoice_settings');
        });

        Schema::create('message_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('body');
            $table->timestamps();

            $table->index('studio_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_templates');

        Schema::table('studios', function (Blueprint $table) {
            $table->dropColumn('email_signature');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn('tags');
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['is_internal', 'opened_at']);
        });

        Schema::dropIfExists('notifications');
    }
};
