<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Jobs\RenderCoverDerivative;
use App\Models\Collection;
use App\Models\Photo;
use App\Models\PriceSheet;
use App\Models\Project;
use App\Models\Studio;
use App\Support\ClientEmailContent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            ->with('coverPhoto:id,derivative_keys')
            ->latest()
            ->paginate(24)
            ->through(fn (Collection $c) => [
                ...$c->toArray(),
                'cover_url' => $this->coverThumbUrl($c),
            ]);

        return Inertia::render('Collections/Index', [
            'collections' => $collections,
        ]);
    }

    /** A signed thumbnail for the list view — the chosen cover, else the first ready photo. */
    private function coverThumbUrl(Collection $collection): ?string
    {
        $photo = $collection->coverPhoto
            ?? $collection->photos()->where('status', 'ready')->orderBy('position')->first();

        return $photo?->signedUrl('thumb', 120) ?? $photo?->signedUrl('web', 120);
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

        $studio = $request->user()->studio;
        $defaults = $studio->gallery_defaults ?? [];

        $attributes = [
            ...$validated,
            'slug' => $this->uniqueSlug($validated['title']),
            'status' => 'draft',
        ];

        // Apply the studio's saved gallery defaults (theme, cover, downloads,
        // favourites, guest uploads). guest_upload_settings.set_id is per-gallery,
        // so it's never carried over.
        foreach (['theme', 'cover_style', 'download_settings', 'favourite_settings'] as $key) {
            if (array_key_exists($key, $defaults) && $defaults[$key] !== null) {
                $attributes[$key] = $defaults[$key];
            }
        }
        if (! empty($defaults['guest_upload_settings'])) {
            $guest = $defaults['guest_upload_settings'];
            unset($guest['set_id']);
            $attributes['guest_upload_settings'] = $guest;
        }
        if (array_key_exists('email_gate', $defaults)) {
            $attributes['privacy'] = ['email_gate' => (bool) $defaults['email_gate']];
        }

        // Attach a price sheet so the store is live by default: the saved default,
        // else the studio's default (Prodigi lab) sheet.
        $attributes['price_sheet_id'] = $defaults['price_sheet_id']
            ?? PriceSheet::where('studio_id', $studio->id)->where('is_default', true)->value('id');

        $collection = Collection::create($attributes);

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

    /**
     * Snapshot this gallery's settings as the studio-wide template applied to
     * every newly created gallery.
     */
    public function saveAsDefaults(Collection $collection): RedirectResponse
    {
        $guest = $collection->guest_upload_settings ?? [];
        unset($guest['set_id']); // per-gallery, never templated

        $collection->studio->update(['gallery_defaults' => [
            'theme' => $collection->theme,
            'cover_style' => $collection->cover_style,
            'download_settings' => $collection->download_settings,
            'favourite_settings' => $collection->favourite_settings,
            'guest_upload_settings' => $guest ?: null,
            'email_gate' => (bool) ($collection->privacy['email_gate'] ?? false),
            'price_sheet_id' => $collection->price_sheet_id,
        ]]);

        return back()->with('success', 'Saved as the default for new galleries.');
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

        $collection->loadMissing(['contact', 'studio']);

        return Inertia::render('Collections/Show', [
            'collection' => $this->sanitizedCollection($collection),
            'photos' => $photos,
            'sets' => $sets,
            'activity' => $activity,
            'email_defaults' => ClientEmailContent::defaults($collection),
            'price_sheets' => PriceSheet::orderByDesc('is_default')->orderBy('name')->get(['id', 'name']),
            'projects' => Project::with('contact:id,first_name,last_name')
                ->latest()
                ->get(['id', 'name', 'contact_id'])
                ->map(fn (Project $p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'client' => trim(($p->contact?->first_name ?? '').' '.($p->contact?->last_name ?? '')) ?: null,
                ]),
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
            'theme' => 'sometimes|in:dark,light,cream,stone',
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
            // Store: which price sheet (catalogue) is sold in this gallery
            'price_sheet_id' => 'sometimes|nullable|integer',
            // The project this gallery belongs to (its client is derived from the project)
            'project_id' => 'sometimes|nullable|integer',
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
        if (isset($validated['theme'])) {
            $updates['theme'] = $validated['theme'];
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

        // Store: validate the price sheet belongs to this studio before assigning.
        if (array_key_exists('price_sheet_id', $validated)) {
            $sheetId = $validated['price_sheet_id'];
            $updates['price_sheet_id'] = $sheetId && PriceSheet::whereKey($sheetId)->exists() ? $sheetId : null;
        }

        // Assign the gallery to a project (tenant-scoped) and mirror its client onto
        // the gallery so client-scoped lookups (orders, the contact page) keep working.
        if (array_key_exists('project_id', $validated)) {
            $project = $validated['project_id'] ? Project::find($validated['project_id']) : null;
            $updates['project_id'] = $project?->id;
            $updates['contact_id'] = $project?->contact_id;
        }

        if ($updates) {
            $collection->update($updates);
        }

        // Ensure the chosen cover has a high-res (1920px) derivative for the
        // full-bleed public cover banner; generated lazily, off the queue.
        if (array_key_exists('cover_photo_id', $updates) && $updates['cover_photo_id']) {
            $cover = Photo::find($updates['cover_photo_id']);
            if ($cover && ! $cover->derivativeKey('cover')) {
                RenderCoverDerivative::dispatch($cover->id);
            }
        }

        return back()->with('success', 'Collection updated.');
    }

    public function destroy(Collection $collection): RedirectResponse
    {
        // Photos cascade-delete at the DB level, so their per-photo storage
        // events won't fire — reclaim the collection's storage up front.
        $bytes = (int) $collection->photos()->sum('file_size');
        if ($bytes > 0) {
            Studio::whereKey($collection->studio_id)->update([
                'storage_used' => DB::raw('GREATEST(0, storage_used - '.$bytes.')'),
            ]);
        }

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
