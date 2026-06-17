<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class CollectionController extends Controller
{
    public function index(): Response
    {
        $collections = Collection::query()
            ->withCount('photos')
            ->latest()
            ->paginate(24);

        return Inertia::render('Collections/Index', [
            'collections' => $collections,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Collections/Create');
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'event_date' => 'nullable|date',
        ]);

        $collection = Collection::create([
            ...$validated,
            'slug' => $this->uniqueSlug($validated['title']),
            'status' => 'draft',
        ]);

        // Every collection starts with a default "Highlights" set — photos always
        // live in a set (no catch-all "all photos" view).
        $collection->sets()->create([
            'name' => 'Highlights',
            'position' => 1,
            'visible' => true,
        ]);

        return redirect()->route('collections.show', $collection)
            ->with('success', 'Collection created.');
    }

    public function show(Collection $collection): Response
    {
        $photos = $collection->photos()
            ->orderBy('position')
            ->get()
            ->map(fn ($photo) => $this->withUrls($photo));

        $sets = $collection->sets()->orderBy('position')->get();

        $activity = $collection->favouriteLists()
            ->has('favourites')
            ->with([
                'visitor:id,name,email',
                'favourites.photo:id,filename,derivative_keys,width,height',
            ])
            ->get()
            ->map(fn ($list) => [
                'id' => $list->id,
                'name' => $list->name,
                'visitor' => $list->visitor
                    ? ['name' => $list->visitor->name, 'email' => $list->visitor->email]
                    : null,
                'count' => $list->favourites->count(),
                'photos' => $list->favourites->map(fn ($fav) => [
                    'id' => $fav->photo?->id,
                    'filename' => $fav->photo?->filename,
                    'thumb_url' => $fav->photo?->signedUrl('thumb', 60),
                    'note' => $fav->note,
                ])->filter(fn ($p) => $p['id'])->values(),
                'notes_count' => $list->favourites->whereNotNull('note')->count(),
            ]);

        return Inertia::render('Collections/Show', [
            'collection' => $this->sanitizedCollection($collection),
            'photos' => $photos,
            'sets' => $sets,
            'activity' => $activity,
        ]);
    }

    public function update(Request $request, Collection $collection): RedirectResponse
    {
        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'event_date' => 'sometimes|nullable|date',
            'status' => 'sometimes|in:draft,published',
            'cover_photo_id' => 'sometimes|nullable|integer|exists:photos,id',
            // Cover styling
            'cover_style' => 'sometimes|nullable|array',
            'cover_style.layout' => 'sometimes|in:none,center,bottom-left,bottom-center',
            'cover_style.font' => 'sometimes|in:sans,serif,helvetica,georgia,palatino,garamond,baskerville,didot,futura,mono,courier',
            'cover_style.theme' => 'sometimes|in:light,dark',
            'cover_style.height' => 'sometimes|in:short,medium,tall',
            'cover_style.overlay' => 'sometimes|integer|min:0|max:80',
            'cover_style.focal_x' => 'sometimes|numeric|min:0|max:100',
            'cover_style.focal_y' => 'sometimes|numeric|min:0|max:100',
            // Privacy
            'privacy_password' => 'sometimes|nullable|string|max:100',
            'privacy_clear_password' => 'sometimes|boolean',
            'privacy_email_gate' => 'sometimes|boolean',
            // Downloads
            'downloads_enabled' => 'sometimes|boolean',
            'downloads_allow_original' => 'sometimes|boolean',
            'downloads_require_pin' => 'sometimes|boolean',
            'downloads_pin' => 'sometimes|nullable|string|max:20',
            // Favourites
            'favourites_enabled' => 'sometimes|boolean',
            'favourites_show_notes' => 'sometimes|boolean',
        ]);

        $updates = [];

        if (isset($validated['title'])) {
            $updates['title'] = $validated['title'];
        }
        if (array_key_exists('event_date', $validated)) {
            $updates['event_date'] = $validated['event_date'];
        }
        if (isset($validated['status'])) {
            $updates['status'] = $validated['status'];
            if ($validated['status'] === 'published' && $collection->status === 'draft') {
                $updates['published_at'] = now();
            }
        }
        if (array_key_exists('cover_photo_id', $validated)) {
            $updates['cover_photo_id'] = $validated['cover_photo_id'];
        }
        if (array_key_exists('cover_style', $validated)) {
            $updates['cover_style'] = $validated['cover_style'] ?: null;
        }

        // Privacy
        $privacy = $collection->privacy ?? [];
        if (! empty($validated['privacy_clear_password'])) {
            unset($privacy['password_hash']);
        } elseif (isset($validated['privacy_password']) && $validated['privacy_password'] !== '') {
            $privacy['password_hash'] = Hash::make($validated['privacy_password']);
        }
        if (isset($validated['privacy_email_gate'])) {
            $privacy['email_gate'] = $validated['privacy_email_gate'];
        }
        if ($privacy !== ($collection->privacy ?? [])) {
            $updates['privacy'] = $privacy ?: null;
        }

        // Downloads
        $downloads = $collection->download_settings ?? [];
        foreach ([
            'downloads_enabled' => 'enabled',
            'downloads_allow_original' => 'allow_original',
            'downloads_require_pin' => 'require_pin',
            'downloads_pin' => 'pin',
        ] as $input => $key) {
            if (isset($validated[$input])) {
                $downloads[$key] = $validated[$input];
            }
        }
        if ($downloads !== ($collection->download_settings ?? [])) {
            $updates['download_settings'] = $downloads ?: null;
        }

        // Favourites
        $favourites = $collection->favourite_settings ?? [];
        foreach ([
            'favourites_enabled' => 'enabled',
            'favourites_show_notes' => 'show_notes',
        ] as $input => $key) {
            if (isset($validated[$input])) {
                $favourites[$key] = $validated[$input];
            }
        }
        if ($favourites !== ($collection->favourite_settings ?? [])) {
            $updates['favourite_settings'] = $favourites ?: null;
        }

        if ($updates) {
            $collection->update($updates);
        }

        return back()->with('success', 'Collection updated.');
    }

    public function destroy(Collection $collection): RedirectResponse
    {
        $collection->delete();

        return redirect()->route('collections.index')
            ->with('success', 'Collection deleted.');
    }

    private function withUrls($photo): array
    {
        $data = $photo->toArray();

        foreach (['thumb', 'web', 'preview'] as $variant) {
            $key = $photo->derivativeKey($variant);
            $data["{$variant}_url"] = $key
                ? Storage::disk('wasabi')->temporaryUrl($key, now()->addHour())
                : null;
        }

        return $data;
    }

    private function sanitizedCollection(Collection $collection): array
    {
        $data = $collection->toArray();

        // Never expose password hash to frontend
        if (isset($data['privacy']['password_hash'])) {
            $data['privacy']['has_password'] = true;
            unset($data['privacy']['password_hash']);
        } else {
            $data['privacy']['has_password'] = false;
        }

        // Never expose raw PIN to frontend
        if (isset($data['download_settings']['pin'])) {
            $data['download_settings']['has_pin'] = $data['download_settings']['pin'] !== null
                && $data['download_settings']['pin'] !== '';
            unset($data['download_settings']['pin']);
        }

        return $data;
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title);
        $slug = $base.'-'.Str::lower(Str::random(6));

        while (Collection::withoutGlobalScopes()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.Str::lower(Str::random(6));
        }

        return $slug;
    }
}
