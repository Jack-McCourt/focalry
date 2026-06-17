<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\Set;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class SetController extends Controller
{
    public function store(Request $request, Collection $collection): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $maxPosition = $collection->sets()->max('position') ?? 0;

        $collection->sets()->create([
            'name' => $validated['name'],
            'position' => $maxPosition + 1,
            'visible' => true,
        ]);

        return back()->with('success', 'Set created.');
    }

    public function update(Request $request, Collection $collection, Set $set): RedirectResponse
    {
        abort_unless($set->collection_id === $collection->id, 403);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'visible' => 'sometimes|boolean',
        ]);

        $set->update($validated);

        return back()->with('success', 'Set updated.');
    }

    public function destroy(Collection $collection, Set $set): RedirectResponse
    {
        abort_unless($set->collection_id === $collection->id, 403);

        // A gallery must always have at least one set (photos can't be orphaned).
        $fallback = $collection->sets()
            ->where('id', '!=', $set->id)
            ->orderBy('position')
            ->first();

        if (! $fallback) {
            return back()->with('error', 'A gallery must have at least one set.');
        }

        // Move this set's photos into the next set rather than orphaning them.
        $set->photos()->update(['set_id' => $fallback->id]);
        $set->delete();

        return back()->with('success', "Set deleted. Photos moved to “{$fallback->name}”.");
    }

    public function reorder(Request $request, Collection $collection): RedirectResponse
    {
        $validated = $request->validate([
            'order' => 'required|array',
            'order.*' => 'integer',
        ]);

        $setIds = $collection->sets()->pluck('id')->toArray();

        foreach ($validated['order'] as $position => $setId) {
            if (in_array($setId, $setIds)) {
                $collection->sets()->where('id', $setId)->update(['position' => $position + 1]);
            }
        }

        return back()->with('success', 'Sets reordered.');
    }
}
