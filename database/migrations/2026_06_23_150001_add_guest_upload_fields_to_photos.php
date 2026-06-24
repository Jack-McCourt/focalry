<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mark photos contributed by event guests via the QR upload page. When a
 * collection requires approval, guest photos start unapproved and are hidden
 * from the public gallery until the studio approves them. Studio-uploaded
 * photos are always approved.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->boolean('is_guest_upload')->default(false)->after('status');
            $table->boolean('approved')->default(true)->after('is_guest_upload');
            $table->string('uploader_name')->nullable()->after('approved');
        });
    }

    public function down(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->dropColumn(['is_guest_upload', 'approved', 'uploader_name']);
        });
    }
};
