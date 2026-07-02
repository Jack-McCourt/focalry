<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ContactController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->input('search', ''));

        $contacts = Contact::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('company', 'like', "%{$search}%");
                });
            })
            ->withCount('collections')
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->paginate(30)
            ->withQueryString();

        return Inertia::render('Contacts/Index', [
            'contacts' => $contacts,
            'filters' => [
                'search' => $search,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $contact = Contact::create($this->validateContact($request));

        return redirect()
            ->route('contacts.show', $contact)
            ->with('success', 'Contact created.');
    }

    public function show(Contact $contact): Response
    {
        $contact->loadCount('collections');
        $contact->load('portalAccess');

        return Inertia::render('Contacts/Show', [
            'contact' => $contact,
            'portal' => $contact->portalAccess ? [
                'url' => $contact->portalAccess->url(),
                'code' => $contact->portalAccess->code,
                'last_viewed_at' => $contact->portalAccess->last_viewed_at?->toIso8601String(),
            ] : null,
            'collections' => $contact->collections()
                ->orderByDesc('event_date')
                ->get(['id', 'title', 'slug', 'status', 'event_date']),
            'projects' => $contact->projects()
                ->with(['status:id,label,color', 'type:id,label,color'])
                ->orderByDesc('event_date')
                ->get(['id', 'name', 'event_date', 'status_id', 'type_id'])
                ->map(fn ($p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'event_date' => $p->event_date?->toDateString(),
                    'status' => $p->status ? ['label' => $p->status->label, 'color' => $p->status->color] : null,
                    'type' => $p->type ? ['label' => $p->type->label, 'color' => $p->type->color] : null,
                ]),
        ]);
    }

    public function update(Request $request, Contact $contact): RedirectResponse
    {
        $contact->update($this->validateContact($request));

        return back()->with('success', 'Contact updated.');
    }

    public function destroy(Contact $contact): RedirectResponse
    {
        $contact->delete();

        return redirect()
            ->route('contacts.index')
            ->with('success', 'Contact deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateContact(Request $request): array
    {
        return $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:50',
            'company' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:5000',
        ]);
    }
}
