<?php

namespace App\Http\Controllers\StudioManager;

use App\Fulfilment\Prodigi\Catalogue;
use App\Http\Controllers\Controller;
use App\Models\PriceSheet;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);

        // Ensure the price sheet belongs to this studio (scoped find).
        PriceSheet::findOrFail($data['price_sheet_id']);

        $product = DB::transaction(function () use ($data) {
            $product = Product::create([
                'price_sheet_id' => $data['price_sheet_id'],
                'category_id' => $data['category_id'] ?? null,
                'type' => $data['type'],
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'digital_resolution' => $data['type'] === 'digital' ? ($data['digital_resolution'] ?? 'high') : null,
                'active' => $data['active'] ?? true,
                'position' => (int) Product::where('price_sheet_id', $data['price_sheet_id'])->max('position') + 1,
            ]);
            $this->syncOptions($product, $data['options']);

            return $product;
        });

        $this->handleImage($request, $product);

        return back()->with('success', 'Product created.');
    }

    /**
     * Add a lab (Prodigi) product to a price sheet from the curated catalogue.
     * Options/SKUs/costs come from the catalogue; the studio only sets retail
     * price and which sizes are enabled afterwards.
     */
    public function storeLab(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'price_sheet_id' => 'required|integer',
            'lab_product_key' => 'required|string',
            'category_id' => 'nullable|integer',
        ]);

        PriceSheet::findOrFail($data['price_sheet_id']); // tenant-scoped guard

        $catalogue = Catalogue::find($data['lab_product_key']);
        abort_if($catalogue === null, 404, 'Unknown lab product.');

        DB::transaction(function () use ($data, $catalogue) {
            $product = Product::create([
                'price_sheet_id' => $data['price_sheet_id'],
                'category_id' => $data['category_id'] ?? null,
                'type' => 'print',
                'lab_product_key' => $catalogue['key'],
                'name' => $catalogue['name'],
                'description' => $catalogue['description'] ?? null,
                'active' => true,
                'position' => (int) Product::where('price_sheet_id', $data['price_sheet_id'])->max('position') + 1,
            ]);

            foreach (array_values($catalogue['sizes']) as $position => $size) {
                $product->options()->create([
                    'studio_id' => $product->studio_id,
                    'lab_sku' => $size['sku'],
                    'name' => $size['label'],
                    'price_cents' => $size['suggested_price_cents'],
                    'cogs_cents' => $size['cogs_cents'],
                    'active' => true,
                    'position' => $position,
                ]);
            }
        });

        return back()->with('success', 'Lab product added — set your prices below.');
    }

    /**
     * Update a lab product: only the retail price and enabled/disabled state of
     * each (fixed) option, plus product-level active/category. SKUs and costs are
     * owned by the catalogue and never editable here.
     */
    public function updateLab(Request $request, Product $product): RedirectResponse
    {
        abort_unless($product->isLab(), 422, 'Not a lab product.');

        $data = $request->validate([
            'active' => 'boolean',
            'category_id' => 'nullable|integer',
            'options' => 'required|array|min:1',
            'options.*.id' => 'required|integer',
            'options.*.price_cents' => 'required|integer|min:0',
            'options.*.active' => 'boolean',
        ]);

        DB::transaction(function () use ($product, $data) {
            $product->update([
                'active' => $data['active'] ?? true,
                'category_id' => $data['category_id'] ?? null,
            ]);

            foreach ($data['options'] as $opt) {
                $product->options()->whereKey($opt['id'])->update([
                    'price_cents' => (int) $opt['price_cents'],
                    'active' => $opt['active'] ?? true,
                ]);
            }
        });

        return back()->with('success', 'Lab product updated.');
    }

    public function update(Request $request, Product $product): RedirectResponse
    {
        abort_if($product->isLab(), 422, 'Use the lab product editor for catalogue products.');

        $data = $this->validated($request);

        DB::transaction(function () use ($product, $data) {
            $product->update([
                'category_id' => $data['category_id'] ?? null,
                'type' => $data['type'],
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'digital_resolution' => $data['type'] === 'digital' ? ($data['digital_resolution'] ?? 'high') : null,
                'active' => $data['active'] ?? true,
            ]);
            $this->syncOptions($product, $data['options']);
        });

        $this->handleImage($request, $product);

        return back()->with('success', 'Product updated.');
    }

    public function destroy(Product $product): RedirectResponse
    {
        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }
        $product->delete();

        return back()->with('success', 'Product deleted.');
    }

    public function reorder(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer',
        ]);

        foreach ($data['ids'] as $position => $id) {
            Product::where('id', $id)->update(['position' => $position]);
        }

        return back();
    }

    /**
     * Replace the product's options with the submitted set. Options carry the
     * pricing, so a product always has at least one.
     *
     * @param  array<int, array{id?: int, name: string, price_cents: int, cogs_cents?: ?int, active?: bool}>  $options
     */
    private function syncOptions(Product $product, array $options): void
    {
        $keptIds = [];
        foreach (array_values($options) as $position => $opt) {
            $row = $product->options()->updateOrCreate(
                ['id' => $opt['id'] ?? null],
                [
                    'studio_id' => $product->studio_id,
                    'name' => $opt['name'],
                    'price_cents' => (int) $opt['price_cents'],
                    'cogs_cents' => isset($opt['cogs_cents']) ? (int) $opt['cogs_cents'] : null,
                    'active' => $opt['active'] ?? true,
                    'position' => $position,
                ],
            );
            $keptIds[] = $row->id;
        }

        $product->options()->whereNotIn('id', $keptIds)->delete();
    }

    private function handleImage(Request $request, Product $product): void
    {
        $request->validate(['image' => 'nullable|image|mimes:png,jpg,jpeg,webp|max:5120']);

        if ($request->hasFile('image')) {
            if ($product->image_path) {
                Storage::disk('public')->delete($product->image_path);
            }
            $path = $request->file('image')->store("studios/{$product->studio_id}/products", 'public');
            $product->update(['image_path' => $path]);
        }
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        return $request->validate([
            'price_sheet_id' => 'required|integer',
            'category_id' => 'nullable|integer',
            'type' => ['required', Rule::in(['print', 'digital', 'package', 'self'])],
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'digital_resolution' => ['nullable', Rule::in(['web', 'high', 'original'])],
            'active' => 'boolean',
            'options' => 'required|array|min:1',
            'options.*.id' => 'nullable|integer',
            'options.*.name' => 'required|string|max:255',
            'options.*.price_cents' => 'required|integer|min:0',
            'options.*.cogs_cents' => 'nullable|integer|min:0',
            'options.*.active' => 'boolean',
        ]);
    }
}
