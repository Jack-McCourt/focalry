<?php

namespace App\Http\Controllers\StudioManager;

use App\Fulfilment\Prodigi\Catalogue;
use App\Http\Controllers\Controller;
use App\Models\PriceSheet;
use App\Models\Product;
use App\Support\Currencies;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PriceSheetController extends Controller
{
    public function index(Request $request): Response
    {
        $studio = $request->user()->studio;

        $sheets = PriceSheet::orderByDesc('is_default')->orderBy('name')->get();

        // The sheet currently being edited (?sheet=id, else the default, else the first).
        $selectedId = (int) $request->query('sheet');
        $selected = $sheets->firstWhere('id', $selectedId)
            ?? $sheets->firstWhere('is_default', true)
            ?? $sheets->first();

        $categories = [];
        $products = [];
        if ($selected) {
            $categories = $selected->categories()->get(['id', 'name', 'position']);
            $products = $selected->products()
                ->with('options')
                ->get()
                ->map(fn (Product $p) => [
                    'id' => $p->id,
                    'category_id' => $p->category_id,
                    'type' => $p->type,
                    'name' => $p->name,
                    'description' => $p->description,
                    'image_url' => $p->imageUrl(),
                    'digital_resolution' => $p->digital_resolution,
                    'active' => $p->active,
                    'position' => $p->position,
                    'is_lab' => $p->isLab(),
                    'lab_product_key' => $p->lab_product_key,
                    'fulfilment' => $p->fulfilmentMode(),
                    'options' => $p->options->map(fn ($o) => [
                        'id' => $o->id,
                        'name' => $o->name,
                        'price_cents' => $o->price_cents,
                        'cogs_cents' => $o->cogs_cents,
                        'active' => $o->active,
                        'lab_sku' => $o->lab_sku,
                    ]),
                ]);
        }

        return Inertia::render('Store/Products', [
            'price_sheets' => $sheets->map(fn ($s) => $s->only(['id', 'name', 'is_default', 'fulfilment', 'currency'])),
            'selected_sheet_id' => $selected?->id,
            'categories' => $categories,
            'products' => $products,
            'default_currency' => $studio?->default_currency ?? 'gbp',
            'currencies' => collect(Currencies::CURRENCIES)->map(fn ($label, $code) => ['code' => $code, 'label' => $label])->values(),
            // The Prodigi catalogue available to add to lab-fulfilled price sheets.
            'lab_catalogue' => Catalogue::all(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $sheet = DB::transaction(function () use ($data) {
            if ($data['is_default'] ?? false) {
                PriceSheet::where('is_default', true)->update(['is_default' => false]);
            }

            return PriceSheet::create($data);
        });

        return redirect()->route('store.products.index', ['sheet' => $sheet->id])->with('success', 'Price sheet created.');
    }

    public function update(Request $request, PriceSheet $priceSheet): RedirectResponse
    {
        $data = $this->validated($request);
        DB::transaction(function () use ($data, $priceSheet) {
            if (($data['is_default'] ?? false) && ! $priceSheet->is_default) {
                PriceSheet::where('is_default', true)->update(['is_default' => false]);
            }
            $priceSheet->update($data);
        });

        return back()->with('success', 'Price sheet updated.');
    }

    public function destroy(PriceSheet $priceSheet): RedirectResponse
    {
        $priceSheet->delete();

        return redirect()->route('store.products.index')->with('success', 'Price sheet deleted.');
    }

    public function setDefault(PriceSheet $priceSheet): RedirectResponse
    {
        DB::transaction(function () use ($priceSheet) {
            PriceSheet::where('is_default', true)->update(['is_default' => false]);
            $priceSheet->update(['is_default' => true]);
        });

        return back()->with('success', 'Default price sheet set.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => 'required|string|max:255',
            'fulfilment' => ['required', Rule::in(['self', 'lab'])],
            'currency' => ['required', 'string', Rule::in(Currencies::codes())],
            'is_default' => 'boolean',
        ]);
    }
}
