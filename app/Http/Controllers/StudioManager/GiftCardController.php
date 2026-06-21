<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\CreditLedgerEntry;
use App\Models\GiftCard;
use App\Support\Currencies;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class GiftCardController extends Controller
{
    public function index(Request $request): Response
    {
        $studio = $request->user()->studio;

        return Inertia::render('Store/GiftCards', [
            'gift_cards' => GiftCard::latest()->get()->map(fn (GiftCard $g) => [
                ...$g->only(['id', 'code', 'initial_cents', 'balance_cents', 'currency', 'recipient_email', 'note', 'active']),
                'expires_at' => $g->expires_at?->toDateString(),
            ]),
            'default_currency' => $studio?->default_currency ?? 'gbp',
            'currencies' => collect(Currencies::CURRENCIES)->map(fn ($label, $code) => ['code' => $code, 'label' => $label])->values(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'initial_cents' => 'required|integer|min:1',
            'currency' => ['required', 'string', Rule::in(Currencies::codes())],
            'recipient_email' => 'nullable|email|max:255',
            'note' => 'nullable|string|max:500',
            'expires_at' => 'nullable|date',
        ]);

        DB::transaction(function () use ($data) {
            $card = GiftCard::create([
                'code' => $this->uniqueCode(),
                'initial_cents' => $data['initial_cents'],
                'balance_cents' => $data['initial_cents'],
                'currency' => $data['currency'],
                'recipient_email' => $data['recipient_email'] ?? null,
                'note' => $data['note'] ?? null,
                'expires_at' => $data['expires_at'] ?? null,
            ]);

            CreditLedgerEntry::create([
                'studio_id' => $card->studio_id,
                'gift_card_id' => $card->id,
                'delta_cents' => $card->initial_cents,
                'balance_after_cents' => $card->balance_cents,
                'reason' => 'Gift card issued',
            ]);
        });

        return back()->with('success', 'Gift card issued.');
    }

    public function update(Request $request, GiftCard $giftCard): RedirectResponse
    {
        $data = $request->validate(['active' => 'required|boolean']);
        $giftCard->update($data);

        return back()->with('success', 'Gift card updated.');
    }

    private function uniqueCode(): string
    {
        do {
            $code = strtoupper(Str::random(4).'-'.Str::random(4).'-'.Str::random(4));
        } while (GiftCard::withoutGlobalScopes()->where('studio_id', app('current.studio.id'))->where('code', $code)->exists());

        return $code;
    }
}
