<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\PriceSheet;
use App\Models\ProductCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ProductCategoryController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'price_sheet_id' => 'required|integer',
            'name' => 'required|string|max:255',
        ]);

        PriceSheet::findOrFail($data['price_sheet_id']); // tenant-scoped guard

        ProductCategory::create([
            'price_sheet_id' => $data['price_sheet_id'],
            'name' => $data['name'],
            'position' => (int) ProductCategory::where('price_sheet_id', $data['price_sheet_id'])->max('position') + 1,
        ]);

        return back()->with('success', 'Category added.');
    }

    public function update(Request $request, ProductCategory $productCategory): RedirectResponse
    {
        $data = $request->validate(['name' => 'required|string|max:255']);
        $productCategory->update($data);

        return back()->with('success', 'Category updated.');
    }

    public function destroy(ProductCategory $productCategory): RedirectResponse
    {
        // Products keep their data; they just become uncategorised (nullOnDelete).
        $productCategory->delete();

        return back()->with('success', 'Category deleted.');
    }

    public function reorder(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer',
        ]);

        foreach ($data['ids'] as $position => $id) {
            ProductCategory::where('id', $id)->update(['position' => $position]);
        }

        return back();
    }
}
