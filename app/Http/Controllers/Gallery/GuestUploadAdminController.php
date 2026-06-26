<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\Photo;
use App\Models\Set;
use Barryvdh\DomPDF\Facade\Pdf;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\PngWriter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Studio-side management of guest QR uploads for a collection: settings, the
 * printable A6 QR card, and moderation of guest-contributed photos.
 */
class GuestUploadAdminController extends Controller
{
    public function index(Collection $collection): Response
    {
        $settings = $this->settings($collection);
        $uploadUrl = route('gallery.guest-upload', $collection->slug);

        $photos = $collection->photos()
            ->where('is_guest_upload', true)
            ->orderByDesc('id')
            ->get(['id', 'filename', 'status', 'approved', 'uploader_name', 'caption', 'derivative_keys', 'created_at'])
            ->map(fn (Photo $p) => [
                'id' => $p->id,
                'filename' => $p->filename,
                'status' => $p->status,
                'approved' => (bool) $p->approved,
                'uploader_name' => $p->uploader_name,
                'caption' => $p->caption,
                'thumb_url' => $p->firstSignedUrl(['thumb', 'grid', 'web', 'preview'], 60),
                'created_at' => $p->created_at?->toIso8601String(),
            ]);

        return Inertia::render('Collections/GuestUploads', [
            'collection' => [
                'id' => $collection->id,
                'title' => $collection->title,
                'slug' => $collection->slug,
            ],
            'settings' => $settings,
            'upload_url' => $uploadUrl,
            'qr_data_uri' => $this->qrDataUri($uploadUrl, 600),
            'photos' => $photos,
        ]);
    }

    public function update(Request $request, Collection $collection): RedirectResponse
    {
        $validated = $request->validate([
            'enabled' => 'required|boolean',
            'pin' => 'nullable|string|max:12',
            'require_approval' => 'required|boolean',
            'show_as_tab' => 'required|boolean',
            'title' => 'nullable|string|max:120',
            'message' => 'nullable|string|max:500',
        ]);

        $settings = $this->settings($collection);
        $settings['enabled'] = $validated['enabled'];
        $settings['pin'] = $validated['pin'] !== null && $validated['pin'] !== '' ? $validated['pin'] : null;
        $settings['require_approval'] = $validated['require_approval'];
        $settings['show_as_tab'] = $validated['show_as_tab'];
        $settings['title'] = $validated['title'] ?: null;
        $settings['message'] = $validated['message'] ?: null;

        // Ensure the dedicated guest set exists once the feature is enabled, and
        // keep its visibility in step with the "show as tab" toggle.
        if ($settings['enabled']) {
            $set = $this->ensureGuestSet($collection, $settings);
            $settings['set_id'] = $set->id;
            if ($set->visible !== $settings['show_as_tab']) {
                $set->update(['visible' => $settings['show_as_tab']]);
            }
        } elseif (! empty($settings['set_id'])) {
            // Hide the guest tab while the feature is off; keep the photos.
            $collection->sets()->whereKey($settings['set_id'])->update(['visible' => false]);
        }

        $collection->update(['guest_upload_settings' => $settings]);

        return back()->with('success', 'Guest upload settings saved.');
    }

    public function approve(Collection $collection, Photo $photo): RedirectResponse
    {
        abort_unless($photo->collection_id === $collection->id && $photo->is_guest_upload, 404);

        $photo->update(['approved' => true]);

        return back()->with('success', 'Photo approved.');
    }

    /** A6 printable card with the QR code, title, PIN, and instructions. */
    public function card(Collection $collection): SymfonyResponse
    {
        $settings = $this->settings($collection);
        $uploadUrl = route('gallery.guest-upload', $collection->slug);

        $pdf = Pdf::loadView('pdf.guest-upload-card', [
            'studioName' => $collection->studio->name,
            'title' => Str::limit($settings['title'] ?: 'Share your photos', 60),
            // Cap the printed message so an unusually long one can't spill the card
            // onto a second page.
            'message' => Str::limit($settings['message'] ?: 'Scan the code to add your photos to the gallery.', 110),
            'pin' => $settings['pin'] ?? null,
            'qrDataUri' => $this->qrDataUri($uploadUrl, 600),
            'uploadUrl' => $uploadUrl,
        ])->setPaper('a6');

        return $pdf->download('guest-uploads-'.$collection->slug.'.pdf');
    }

    /**
     * Settings merged onto sane defaults so the admin form always has a complete
     * shape to bind to.
     */
    private function settings(Collection $collection): array
    {
        return array_merge([
            'enabled' => false,
            'pin' => null,
            'require_approval' => false,
            'show_as_tab' => true,
            'set_id' => null,
            'title' => 'Share your photos',
            'message' => 'Add the photos you took today to the gallery.',
        ], $collection->guest_upload_settings ?? []);
    }

    private function ensureGuestSet(Collection $collection, array $settings): Set
    {
        if (! empty($settings['set_id'])) {
            $existing = $collection->sets()->find($settings['set_id']);
            if ($existing) {
                return $existing;
            }
        }

        $position = ((int) $collection->sets()->max('position')) + 1;

        return $collection->sets()->create([
            'name' => 'Guest Photos',
            'position' => $position,
            'visible' => (bool) ($settings['show_as_tab'] ?? true),
        ]);
    }

    /**
     * QR code as a base64 PNG data URI. PNG (rendered via GD) embeds reliably in
     * both the browser and dompdf — unlike inline SVG, which dompdf renders
     * inconsistently.
     */
    private function qrDataUri(string $data, int $size = 320): string
    {
        $qr = QrCode::create($data)->setSize($size)->setMargin(8);

        return (new PngWriter)->write($qr)->getDataUri();
    }
}
