<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A studio's marketing website. One per studio for now, but modelled as a
        // separate table so a studio could have several sites later.
        Schema::create('sites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();          // public URL: /site/{slug}
            $table->string('template')->default('portfolio');
            $table->json('theme')->nullable();          // {primary_color, font, ...}
            $table->string('contact_email')->nullable(); // where lead notifications surface
            $table->string('seo_title')->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->boolean('is_published')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index('studio_id');
        });

        // Pages within a site. Content is a modular ordered list of blocks (JSON),
        // so block types can be added without schema changes.
        Schema::create('site_pages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('site_id')->constrained()->cascadeOnDelete();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('slug');
            $table->unsignedInteger('position')->default(0);
            $table->boolean('is_home')->default(false);
            $table->json('blocks')->nullable();          // [{id,type,data}]
            $table->string('seo_title')->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->timestamps();

            $table->unique(['site_id', 'slug']);
            $table->index(['site_id', 'position']);
        });

        // A contact-form submission. Always logged here, and (best-effort) fanned out
        // into a Contact + Project lead so it lands in the CRM.
        Schema::create('site_leads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('site_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->date('event_date')->nullable();
            $table->string('event_type')->nullable();
            $table->text('message')->nullable();
            $table->json('payload')->nullable();          // raw submission for audit
            $table->timestamps();

            $table->index(['studio_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_leads');
        Schema::dropIfExists('site_pages');
        Schema::dropIfExists('sites');
    }
};
