<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Blog posts are now just pages (built with blocks) nested under a page
        // that's been designated the "blog page" (is_blog), mirroring is_home.
        Schema::table('site_pages', function (Blueprint $table) {
            $table->foreignId('parent_id')->nullable()->after('site_id')->constrained('site_pages')->cascadeOnDelete();
            $table->boolean('is_blog')->default(false)->after('is_home');
            // Post-only metadata (used when a page is a child of the blog page).
            $table->string('status')->default('published')->after('blocks'); // draft | published
            $table->timestamp('published_at')->nullable()->after('status');
            $table->text('excerpt')->nullable()->after('published_at');
            $table->string('cover_image')->nullable()->after('excerpt');
        });

        Schema::dropIfExists('site_blog_posts');
    }

    public function down(): void
    {
        Schema::table('site_pages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_id');
            $table->dropColumn(['is_blog', 'status', 'published_at', 'excerpt', 'cover_image']);
        });

        // Recreate the dropped table (structure only) for rollback symmetry.
        Schema::create('site_blog_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('site_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('slug');
            $table->text('excerpt')->nullable();
            $table->string('cover_image')->nullable();
            $table->longText('body')->nullable();
            $table->string('status')->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
            $table->unique(['site_id', 'slug']);
        });
    }
};
