<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        // WordPress-style hierarchical taxonomy for blog posts. Categories live in
        // their own table (stable IDs) so they survive the builder's delete-and-
        // recreate page save cycle; posts reference them by id in `category_ids`.
        Schema::create('site_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('studio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('site_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('site_categories')->nullOnDelete();
            $table->string('name', 80);
            $table->string('slug', 80);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['site_id', 'parent_id']);
            $table->unique(['site_id', 'slug']);
        });

        Schema::table('site_pages', function (Blueprint $table) {
            // A post may belong to several categories (incl. a parent and its child).
            $table->json('category_ids')->nullable()->after('category');
        });

        $this->migrateExisting();
    }

    /** Turn each distinct free-text `category` value into a (flat) SiteCategory. */
    private function migrateExisting(): void
    {
        $posts = DB::table('site_pages')
            ->whereNotNull('category')
            ->where('category', '<>', '')
            ->get(['id', 'studio_id', 'site_id', 'category']);

        $byKey = []; // "site_id|lowername" => new category id

        foreach ($posts as $post) {
            $name = trim($post->category);
            if ($name === '') {
                continue;
            }

            $key = $post->site_id.'|'.mb_strtolower($name);
            if (! isset($byKey[$key])) {
                $base = Str::slug($name) ?: 'category';
                $slug = $base;
                $n = 1;
                while (DB::table('site_categories')->where('site_id', $post->site_id)->where('slug', $slug)->exists()) {
                    $slug = $base.'-'.(++$n);
                }

                $byKey[$key] = DB::table('site_categories')->insertGetId([
                    'studio_id' => $post->studio_id,
                    'site_id' => $post->site_id,
                    'parent_id' => null,
                    'name' => mb_substr($name, 0, 80),
                    'slug' => $slug,
                    'position' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('site_pages')->where('id', $post->id)->update([
                'category_ids' => json_encode([$byKey[$key]]),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('site_pages', function (Blueprint $table) {
            $table->dropColumn('category_ids');
        });

        Schema::dropIfExists('site_categories');
    }
};
