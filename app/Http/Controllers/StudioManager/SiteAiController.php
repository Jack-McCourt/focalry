<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Support\Ai;
use App\Support\ImageDerivatives;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * AI assists for the website builder: alt text from an image, SEO title +
 * description from page content, and headline suggestions. All server-side —
 * the API key never reaches the browser. Env-gated on ANTHROPIC_API_KEY.
 */
class SiteAiController extends Controller
{
    private function gate(): ?JsonResponse
    {
        return Ai::configured()
            ? null
            : response()->json(['message' => 'AI assists are not set up on this platform yet.'], 422);
    }

    /** Describe one of OUR OWN public images for use as alt text. */
    public function altText(Request $request): JsonResponse
    {
        if ($gate = $this->gate()) {
            return $gate;
        }

        $validated = $request->validate(['image_url' => 'required|string|max:2048']);

        // Same own-asset validation as the /img resizer — never an open proxy.
        $rel = ImageDerivatives::relPath($validated['image_url']);
        if ($rel === null) {
            return response()->json(['message' => 'Only images uploaded to your site can be described.'], 422);
        }

        try {
            // A small derivative keeps vision-input tokens (and latency) down.
            $key = ImageDerivatives::ensure($rel, 640) ?? 'public/'.$rel;
            $image = Storage::disk('wasabi')->get($key);

            $alt = Ai::text(
                'You write alt text for photography websites. Reply with ONLY the alt text: one concise, concrete sentence (under 125 characters), no quotes, no "image of".',
                'Write alt text for this photograph.',
                $image,
                100,
            );

            return response()->json(['alt' => str($alt)->limit(160)->value()]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'Could not describe the image — try again.'], 422);
        }
    }

    /** SEO title + meta description from the page's content. */
    public function seo(Request $request): JsonResponse
    {
        if ($gate = $this->gate()) {
            return $gate;
        }

        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'content' => 'required|string|max:8000',
            'site_name' => 'nullable|string|max:255',
        ]);

        try {
            $json = Ai::text(
                'You write SEO metadata for photography websites. Reply with ONLY valid JSON: {"title": "...", "description": "..."}. Title under 60 characters and naturally includes what/where. Description 140-155 characters, invitingly written, no clickbait.',
                'Site: '.($validated['site_name'] ?? 'a photography studio')."\nPage title: ".($validated['title'] ?? '')."\nPage content:\n".$validated['content'],
                null,
                300,
            );
            $data = json_decode((string) preg_replace('/^```(json)?|```$/m', '', $json), true);

            if (! is_array($data) || empty($data['title'])) {
                return response()->json(['message' => 'Could not generate suggestions — try again.'], 422);
            }

            return response()->json([
                'title' => str((string) $data['title'])->limit(70)->value(),
                'description' => str((string) ($data['description'] ?? ''))->limit(170)->value(),
            ]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'Could not generate suggestions — try again.'], 422);
        }
    }

    /** Three alternative headlines for a given heading + context. */
    public function headlines(Request $request): JsonResponse
    {
        if ($gate = $this->gate()) {
            return $gate;
        }

        $validated = $request->validate([
            'text' => 'required|string|max:300',
            'context' => 'nullable|string|max:1000',
        ]);

        try {
            $json = Ai::text(
                'You write headlines for photography websites — warm, confident, concrete; never cheesy or salesy. Reply with ONLY a JSON array of exactly 3 strings, each under 60 characters.',
                'Current headline: '.$validated['text'].($validated['context'] ? "\nContext: ".$validated['context'] : ''),
                null,
                250,
            );
            $ideas = json_decode((string) preg_replace('/^```(json)?|```$/m', '', $json), true);

            if (! is_array($ideas) || $ideas === []) {
                return response()->json(['message' => 'Could not generate ideas — try again.'], 422);
            }

            return response()->json(['headlines' => array_slice(array_map(fn ($h) => (string) $h, $ideas), 0, 3)]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'Could not generate ideas — try again.'], 422);
        }
    }
}
