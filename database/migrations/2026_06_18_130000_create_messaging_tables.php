<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A two-way email conversation between a studio and a contact. Replies are
        // routed back via the unique reply_token (Postmark +mailbox-hash).
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->string('subject');
            $table->string('reply_token', 40)->unique();
            $table->string('status')->default('open'); // open | archived
            $table->boolean('unread')->default(false);  // unread inbound for the studio
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();

            $table->index(['studio_id', 'status', 'last_message_at']);
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->string('direction'); // outbound (studio→client) | inbound (client→studio)
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // sender, for outbound
            $table->string('author_name')->nullable();
            $table->string('author_email')->nullable();
            $table->text('body');
            $table->string('email_message_id')->nullable(); // for inbound dedup + threading
            $table->string('status')->default('sent'); // sent | failed | received
            $table->text('error')->nullable();
            $table->timestamps();

            $table->index('conversation_id');
            $table->index('email_message_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
    }
};
