<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\TaskTemplate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TaskTemplateController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateTemplate($request);

        DB::transaction(function () use ($data) {
            $template = TaskTemplate::create(['name' => $data['name']]);
            $this->syncItems($template, $data['items'] ?? []);
        });

        return back()->with('success', 'Checklist saved.');
    }

    public function update(Request $request, TaskTemplate $taskTemplate): RedirectResponse
    {
        $data = $this->validateTemplate($request);

        DB::transaction(function () use ($taskTemplate, $data) {
            $taskTemplate->update(['name' => $data['name']]);
            $taskTemplate->items()->delete();
            $this->syncItems($taskTemplate, $data['items'] ?? []);
        });

        return back()->with('success', 'Checklist updated.');
    }

    public function destroy(TaskTemplate $taskTemplate): RedirectResponse
    {
        $taskTemplate->delete();

        return back()->with('success', 'Checklist deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateTemplate(Request $request): array
    {
        return $request->validate([
            'name' => 'required|string|max:255',
            'items' => 'array',
            'items.*.title' => 'required|string|max:255',
            'items.*.offset_days' => 'nullable|integer|min:-3650|max:3650',
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function syncItems(TaskTemplate $template, array $items): void
    {
        foreach (array_values($items) as $i => $item) {
            $template->items()->create([
                'title' => $item['title'],
                'offset_days' => (int) ($item['offset_days'] ?? 0),
                'position' => $i,
            ]);
        }
    }
}
