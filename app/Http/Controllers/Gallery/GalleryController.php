<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\Coupon;
use App\Models\GalleryVisitor;
use App\Models\Product;
use App\Models\ShippingMethod;
use App\Models\Studio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class GalleryController extends Controller
{
    public function show(Request $request, string $slug): Response|RedirectResponse
    {
        $collection = Collection::withoutGlobalScopes()
            ->where('slug', $slug)
            ->firstOrFail();

        if (! $collection->isPublished()) {
            abort(404);
        }

        // Password gate
        if ($collection->isPasswordProtected()) {
            $sessionKey = "gallery_auth_{$collection->id}";
            if (! session()->has($sessionKey)) {
                if ($request->isMethod('post')) {
                    $password = $request->input('password', '');
                    if (Hash::check($password, $collection->privacy['password_hash'])) {
                        session()->put($sessionKey, true);
                    } else {
                        return Inertia::render('Gallery/Password', [
                            'collection' => $this->publicCollectionData($collection),
                            'error' => 'Incorrect password.',
                        ]);
                    }
                } else {
                    return Inertia::render('Gallery/Password', [
                        'collection' => $this->publicCollectionData($collection),
                        'error' => null,
                    ]);
                }
            }
        }

        // Email gate
        $visitor = $this->resolveVisitor($request, $collection);
        if ($collection->isEmailGated() && ! $visitor) {
            if ($request->isMethod('post') && $request->input('email')) {
                $visitor = $this->registerVisitor($request, $collection);
                session()->put("gallery_visitor_{$collection->id}", $visitor->token);
            } else {
                return Inertia::render('Gallery/EmailGate', [
                    'collection' => $this->publicCollectionData($collection),
                ]);
            }
        }

        $favouriteSettings = $collection->favourite_settings ?? [];
        $favouritesEnabled = $favouriteSettings['enabled'] ?? true;

        // If favourites are enabled but there's no visitor yet (no email gate),
        // create a lightweight anonymous identity so favouriting works immediately.
        if (! $visitor && $favouritesEnabled) {
            $visitor = $this->createAnonymousVisitor($collection);
            session()->put("gallery_visitor_{$collection->id}", $visitor->token);
        }

        if ($visitor) {
            $visitor->update(['last_seen_at' => now()]);
        }

        $photos = $collection->photos()
            ->where('status', 'ready')
            ->orderBy('position')
            ->get()
            ->map(fn ($photo) => [
                'id' => $photo->id,
                'filename' => $photo->filename,
                'width' => $photo->width,
                'height' => $photo->height,
                'set_id' => $photo->set_id,
                'thumb_url' => $photo->signedUrl('preview', 120),
                'web_url' => $photo->signedUrl('preview', 120),
            ]);

        $sets = $collection->sets()
            ->where('visible', true)
            ->orderBy('position')
            ->get(['id', 'name', 'position']);

        // Load the visitor's named favourite lists (each with photo IDs + notes)
        $favouriteLists = [];
        if ($visitor) {
            $favouriteLists = $visitor->favouriteLists()
                ->where('collection_id', $collection->id)
                ->with('favourites:id,list_id,photo_id,note')
                ->get()
                ->map(fn ($list) => FavouriteController::serializeList($list))
                ->toArray();
        }

        $downloadSettings = $collection->download_settings ?? [];

        return Inertia::render('Gallery/Show', [
            'collection' => $this->publicCollectionData($collection),
            'photos' => $photos,
            'sets' => $sets,
            'visitor_token' => $visitor?->token,
            'visitor' => $visitor ? ['name' => $visitor->name, 'email' => $visitor->email] : null,
            'favourite_lists' => $favouriteLists,
            'favourites_enabled' => $favouritesEnabled,
            'favourites_show_notes' => $favouriteSettings['show_notes'] ?? false,
            'downloads' => [
                'enabled' => $downloadSettings['enabled'] ?? false,
                'require_pin' => ($downloadSettings['require_pin'] ?? false) && ! empty($downloadSettings['pin']),
                'pin_verified' => (bool) session("gallery_download_pin_{$collection->id}"),
            ],
            'store' => $this->storePayload($collection),
        ]);
    }

    /**
     * Store data for the in-gallery shop: products on the assigned price sheet,
     * shipping methods, and any coupon banner. Null when the gallery isn't selling.
     */
    private function storePayload(Collection $collection): ?array
    {
        $sheet = $collection->effectivePriceSheet();
        if (! $sheet) {
            return null;
        }

        $studio = Studio::find($collection->studio_id);

        $products = Product::withoutGlobalScopes()
            ->where('studio_id', $collection->studio_id)
            ->where('price_sheet_id', $sheet->id)
            ->where('active', true)
            ->with(['options' => fn ($q) => $q->where('active', true)->orderBy('position'), 'category'])
            ->orderBy('position')
            ->get()
            ->filter(fn (Product $p) => $p->options->isNotEmpty())
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'type' => $p->type,
                'description' => $p->description,
                'image_url' => $p->imageUrl(),
                'category' => $p->category?->name,
                'is_digital' => $p->isDigital(),
                'photo_specific' => in_array($p->type, ['print', 'digital'], true),
                'options' => $p->options->map(fn ($o) => [
                    'id' => $o->id,
                    'name' => $o->name,
                    'price_cents' => $o->price_cents,
                ])->values(),
            ])->values();

        if ($products->isEmpty()) {
            return null;
        }

        $shipping = ShippingMethod::withoutGlobalScopes()
            ->where('studio_id', $collection->studio_id)->where('active', true)
            ->orderBy('position')
            ->get(['id', 'name', 'price_cents', 'is_pickup']);

        $banner = Coupon::withoutGlobalScopes()
            ->where('studio_id', $collection->studio_id)
            ->where('active', true)->where('show_banner', true)
            ->whereNotNull('banner_text')
            ->value('banner_text');

        return [
            'enabled' => true,
            'currency' => $sheet->currency ?? $studio?->default_currency ?? 'gbp',
            'can_pay' => $studio?->stripe_connect_status === 'active',
            'products' => $products,
            'shipping_methods' => $shipping,
            'coupon_banner' => $banner,
        ];
    }

    private function publicCollectionData(Collection $collection): array
    {
        return [
            'id' => $collection->id,
            'title' => $collection->title,
            'slug' => $collection->slug,
            'event_date' => $collection->event_date?->toDateString(),
            'cover_style' => $collection->cover_style,
            'cover_url' => $collection->coverPhoto?->signedUrl('web', 120),
        ];
    }

    private function resolveVisitor(Request $request, Collection $collection): ?GalleryVisitor
    {
        $token = session("gallery_visitor_{$collection->id}")
            ?? $request->cookie("gv_{$collection->id}");

        if (! $token) {
            return null;
        }

        return GalleryVisitor::where('collection_id', $collection->id)
            ->where('token', $token)
            ->first();
    }

    private function createAnonymousVisitor(Collection $collection): GalleryVisitor
    {
        return GalleryVisitor::create([
            'collection_id' => $collection->id,
            'token' => Str::random(40),
            'last_seen_at' => now(),
        ]);
    }

    private function registerVisitor(Request $request, Collection $collection): GalleryVisitor
    {
        $email = $request->input('email');
        $visitor = GalleryVisitor::firstOrNew([
            'collection_id' => $collection->id,
            'email' => $email,
        ]);

        if (! $visitor->token) {
            $visitor->token = Str::random(40);
            $visitor->name = $request->input('name');
        }

        $visitor->last_seen_at = now();
        $visitor->save();

        session()->put("gallery_visitor_{$collection->id}", $visitor->token);

        return $visitor;
    }
}
