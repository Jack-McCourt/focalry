<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;

/**
 * Minimal Anthropic Messages API client for the website builder's AI assists
 * (alt text, SEO copy, headline ideas). Uses a small, fast model — these are
 * one-shot, low-token calls. Env-gated on ANTHROPIC_API_KEY.
 */
class Ai
{
    public static function configured(): bool
    {
        return (bool) config('services.anthropic.key');
    }

    /**
     * One text completion. `$image` (optional) is a raw binary string included
     * as a vision input (for alt-text generation).
     */
    public static function text(string $system, string $prompt, ?string $image = null, int $maxTokens = 400): string
    {
        $content = [];
        if ($image !== null) {
            $content[] = [
                'type' => 'image',
                'source' => ['type' => 'base64', 'media_type' => 'image/webp', 'data' => base64_encode($image)],
            ];
        }
        $content[] = ['type' => 'text', 'text' => $prompt];

        $response = Http::withHeaders([
            'x-api-key' => config('services.anthropic.key'),
            'anthropic-version' => '2023-06-01',
        ])->timeout(30)->post('https://api.anthropic.com/v1/messages', [
            'model' => config('services.anthropic.model'),
            'max_tokens' => $maxTokens,
            'system' => $system,
            'messages' => [['role' => 'user', 'content' => $content]],
        ])->throw()->json();

        return trim(collect($response['content'] ?? [])->firstWhere('type', 'text')['text'] ?? '');
    }
}
