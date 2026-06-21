<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\Collection;
use App\Models\Site;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class ContentController extends Controller
{
    public function index(): Response
    {
        $collections = Collection::withoutGlobalScopes()
            ->where('status', 'published')
            ->with('studio:id,name')
            ->withCount('photos')
            ->latest('published_at')
            ->limit(100)
            ->get()
            ->map(fn (Collection $c) => [
                'id' => $c->id,
                'title' => $c->title,
                'slug' => $c->slug,
                'photos_count' => $c->photos_count,
                'studio' => $c->studio ? ['id' => $c->studio->id, 'name' => $c->studio->name] : null,
                'published_at' => $c->published_at?->toIso8601String(),
            ]);

        $sites = Site::withoutGlobalScopes()
            ->where('is_published', true)
            ->with('studio:id,name')
            ->latest('published_at')
            ->limit(100)
            ->get()
            ->map(fn (Site $s) => [
                'id' => $s->id,
                'name' => $s->name,
                'slug' => $s->slug,
                'studio' => $s->studio ? ['id' => $s->studio->id, 'name' => $s->studio->name] : null,
                'published_at' => $s->published_at?->toIso8601String(),
            ]);

        return Inertia::render('Admin/Content', [
            'collections' => $collections,
            'sites' => $sites,
        ]);
    }

    public function takedownCollection(int $collection): RedirectResponse
    {
        $collection = Collection::withoutGlobalScopes()->findOrFail($collection);
        $collection->update(['status' => 'draft']);

        AdminAuditLog::record('content.takedown_collection', $collection, "Took down gallery “{$collection->title}”", [
            'studio_id' => $collection->studio_id,
        ]);

        return back()->with('success', 'Gallery taken down (set to draft).');
    }

    public function takedownSite(int $site): RedirectResponse
    {
        $site = Site::withoutGlobalScopes()->findOrFail($site);
        $site->update(['is_published' => false]);

        AdminAuditLog::record('content.takedown_site', $site, "Took down website “{$site->name}”", [
            'studio_id' => $site->studio_id,
        ]);

        return back()->with('success', 'Website unpublished.');
    }
}
