<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Public\ClientPortalController as PublicPortal;
use App\Models\ClientPortalAccess;
use App\Models\Contact;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;

class ClientPortalController extends Controller
{
    /**
     * Ensure the contact has a portal and email the link + access code to them.
     * Idempotent — re-inviting reuses the existing token/code.
     */
    public function invite(Contact $contact): RedirectResponse
    {
        if (! $contact->email) {
            throw ValidationException::withMessages([
                'email' => 'Add an email address before inviting this client to their portal.',
            ]);
        }

        $access = $this->ensureAccess($contact);
        PublicPortal::dispatchInvite($access);

        return back()->with('success', "Portal invitation sent to {$contact->email}.");
    }

    /** Create the portal (so the studio can copy the link) without emailing. */
    public function create(Contact $contact): RedirectResponse
    {
        $this->ensureAccess($contact);

        return back()->with('success', 'Client portal link created.');
    }

    private function ensureAccess(Contact $contact): ClientPortalAccess
    {
        return ClientPortalAccess::firstOrCreate([
            'contact_id' => $contact->id,
        ], [
            'studio_id' => $contact->studio_id,
        ]);
    }
}
