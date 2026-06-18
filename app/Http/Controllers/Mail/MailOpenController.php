<?php

namespace App\Http\Controllers\Mail;

use App\Http\Controllers\Controller;
use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class MailOpenController extends Controller
{
    /**
     * 1x1 open-tracking pixel for outbound email read receipts. No auth — the
     * URL carries an HMAC token tied to the message id. Always returns the gif
     * so mail clients never see a broken image.
     */
    public function __invoke(Request $request, int $message, string $token): Response
    {
        // Resolve without the studio global scope — this request is unauthenticated.
        $record = Message::withoutGlobalScopes()->find($message);

        if ($record
            && hash_equals($record->openToken(), $token)
            && $record->direction === 'outbound'
            && $record->opened_at === null) {
            $record->forceFill(['opened_at' => now()])->saveQuietly();
        }

        // 1x1 transparent GIF.
        $gif = base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');

        return response($gif, 200, [
            'Content-Type' => 'image/gif',
            'Content-Length' => (string) strlen($gif),
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
        ]);
    }
}
