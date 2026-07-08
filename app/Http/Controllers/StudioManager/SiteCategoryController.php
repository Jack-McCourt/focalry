<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Http\Controllers\StudioManager\Concerns\ResolvesSite;
use App\Models\Site;
use App\Models\SiteCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Blog categories (WordPress-style hierarchical taxonomy). Managed over ajax
 * so the builder can add/rename/delete categories without a full save that
 * would clobber unsaved page edits. Each call returns the whole (flat) list
 * so the client just replaces its categories state.
 */
class SiteCategoryController extends Controller
{
    use ResolvesSite;

    public function store(Request $request): JsonResponse
    {
        $site = $this->resolveSite();
        $data = $request->validate([
            'name' => 'required|string|max:80',
            'parent_id' => ['nullable', 'integer', Rule::exists('site_categories', 'id')->where('site_id', $site->id)],
        ]);

        $site->categories()->create([
            'studio_id' => $site->studio_id,
            'parent_id' => $data['parent_id'] ?? null,
            'name' => trim($data['name']),
            'slug' => $this->uniqueCategorySlug($site, $data['name']),
            'position' => (int) $site->categories()->max('position') + 1,
        ]);

        return response()->json(['categories' => $this->categoriesPayload($site)]);
    }

    public function update(Request $request, SiteCategory $category): JsonResponse
    {
        $site = $this->resolveSite();
        abort_unless($category->site_id === $site->id, 404);

        $data = $request->validate([
            'name' => 'required|string|max:80',
            'parent_id' => ['nullable', 'integer', Rule::exists('site_categories', 'id')->where('site_id', $site->id)],
        ]);

        // A category can't be its own ancestor — block self/descendant parents.
        $parentId = $data['parent_id'] ?? null;
        if ($parentId !== null && ($parentId === $category->id || in_array($parentId, $this->descendantIds($site, $category->id), true))) {
            $parentId = $category->parent_id;
        }

        $category->update([
            'name' => trim($data['name']),
            'parent_id' => $parentId,
        ]);

        return response()->json(['categories' => $this->categoriesPayload($site)]);
    }

    public function destroy(SiteCategory $category): JsonResponse
    {
        $site = $this->resolveSite();
        abort_unless($category->site_id === $site->id, 404);

        DB::transaction(function () use ($site, $category) {
            // WordPress behaviour: children move up to the deleted category's parent.
            $site->categories()->where('parent_id', $category->id)->update(['parent_id' => $category->parent_id]);

            // Detach the category from every post that referenced it.
            foreach ($site->pages()->whereNotNull('category_ids')->get() as $post) {
                $ids = array_values(array_filter($post->category_ids ?? [], fn ($id) => (int) $id !== $category->id));
                if (count($ids) !== count($post->category_ids ?? [])) {
                    $post->update(['category_ids' => $ids]);
                }
            }

            $category->delete();
        });

        return response()->json(['categories' => $this->categoriesPayload($site)]);
    }

    /** @return list<array{id:int,name:string,slug:string,parent_id:int|null}> */
    private function categoriesPayload(Site $site): array
    {
        return $site->categories()->get()->map(fn (SiteCategory $c) => [
            'id' => $c->id,
            'name' => $c->name,
            'slug' => $c->slug,
            'parent_id' => $c->parent_id,
        ])->values()->all();
    }

    /** All descendant category ids of $id within the site (for cycle prevention). */
    private function descendantIds(Site $site, int $id): array
    {
        $all = $site->categories()->get(['id', 'parent_id']);
        $out = [];
        $walk = function (int $parent) use (&$walk, $all, &$out): void {
            foreach ($all->where('parent_id', $parent) as $child) {
                $out[] = $child->id;
                $walk($child->id);
            }
        };
        $walk($id);

        return $out;
    }

    private function uniqueCategorySlug(Site $site, string $name): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $n = 1;
        while ($site->categories()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.(++$n);
        }

        return $slug;
    }
}
