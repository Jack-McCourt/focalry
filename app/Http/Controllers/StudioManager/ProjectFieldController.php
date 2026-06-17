<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\ProjectFieldDefinition;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProjectFieldController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateField($request, withType: true);

        ProjectFieldDefinition::create([
            'key' => $this->uniqueKey($validated['label']),
            'label' => $validated['label'],
            'type' => $validated['type'],
            'options' => $validated['options'] ?? null,
            'position' => (int) ProjectFieldDefinition::max('position') + 1,
        ]);

        return back()->with('success', 'Field added.');
    }

    public function update(Request $request, ProjectFieldDefinition $field): RedirectResponse
    {
        // Label + options are editable; key + type are fixed once created.
        $validated = $this->validateField($request, withType: false);

        $attrs = ['label' => $validated['label']];
        // Only touch options when explicitly provided, so a rename keeps existing choices.
        if ($request->has('options')) {
            $attrs['options'] = $validated['options'] ?? null;
        }
        $field->update($attrs);

        return back()->with('success', 'Field updated.');
    }

    public function destroy(ProjectFieldDefinition $field): RedirectResponse
    {
        $field->delete();

        return back()->with('success', 'Field removed.');
    }

    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'ordered_ids' => 'array',
            'ordered_ids.*' => 'integer',
        ]);

        DB::transaction(function () use ($validated) {
            foreach ($validated['ordered_ids'] as $i => $id) {
                ProjectFieldDefinition::whereKey($id)->update(['position' => $i]);
            }
        });

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function validateField(Request $request, bool $withType): array
    {
        return $request->validate([
            'label' => 'required|string|max:255',
            'type' => [$withType ? 'required' : 'sometimes', Rule::in(ProjectFieldDefinition::TYPES)],
            'options' => 'nullable|array',
            'options.*.label' => 'required|string|max:255',
            'options.*.color' => 'required|string|max:7',
        ]);
    }

    private function uniqueKey(string $label): string
    {
        $base = Str::slug($label, '_') ?: 'field';
        $key = $base;
        $i = 1;

        while (ProjectFieldDefinition::where('key', $key)->exists()) {
            $key = $base.'_'.(++$i);
        }

        return $key;
    }
}
