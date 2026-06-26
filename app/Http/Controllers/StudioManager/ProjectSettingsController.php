<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\ProjectFieldDefinition;
use App\Models\ProjectStatus;
use App\Models\ProjectType;
use App\Models\Studio;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ProjectSettingsController extends Controller
{
    public function edit(): Response
    {
        $studio = Studio::find(app('current.studio.id'));

        return Inertia::render('Projects/Settings', [
            'statuses' => ProjectStatus::orderBy('position')->get(['id', 'label', 'color', 'position']),
            'types' => ProjectType::orderBy('position')->get(['id', 'label', 'color', 'position']),
            'fields' => ProjectFieldDefinition::orderBy('position')->get(['id', 'key', 'label', 'type', 'options', 'position']),
            // Studio-level Google Calendar connection (shared with the Meetings page).
            'calendar' => [
                'connected' => (bool) $studio?->googleCalendarConnected(),
                'email' => $studio?->google_calendar_email,
            ],
        ]);
    }

    // ── Statuses ──────────────────────────────────────────────────────────────
    public function storeStatus(Request $request): RedirectResponse
    {
        $data = $this->validateItem($request);
        ProjectStatus::create([...$data, 'position' => (int) ProjectStatus::max('position') + 1]);

        return back()->with('success', 'Status added.');
    }

    public function updateStatus(Request $request, ProjectStatus $status): RedirectResponse
    {
        $status->update($this->validateItem($request));

        return back()->with('success', 'Status updated.');
    }

    public function destroyStatus(ProjectStatus $status): RedirectResponse
    {
        $status->delete();

        return back()->with('success', 'Status removed.');
    }

    public function reorderStatuses(Request $request): RedirectResponse
    {
        $this->reorder($request, ProjectStatus::class);

        return back();
    }

    // ── Types ─────────────────────────────────────────────────────────────────
    public function storeType(Request $request): RedirectResponse
    {
        $data = $this->validateItem($request);
        ProjectType::create([...$data, 'position' => (int) ProjectType::max('position') + 1]);

        return back()->with('success', 'Type added.');
    }

    public function updateType(Request $request, ProjectType $type): RedirectResponse
    {
        $type->update($this->validateItem($request));

        return back()->with('success', 'Type updated.');
    }

    public function destroyType(ProjectType $type): RedirectResponse
    {
        $type->delete();

        return back()->with('success', 'Type removed.');
    }

    public function reorderTypes(Request $request): RedirectResponse
    {
        $this->reorder($request, ProjectType::class);

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function validateItem(Request $request): array
    {
        return $request->validate([
            'label' => 'required|string|max:255',
            'color' => 'required|string|regex:/^#[0-9a-fA-F]{6}$/',
        ]);
    }

    /**
     * @param  class-string<Model>  $model
     */
    private function reorder(Request $request, string $model): void
    {
        $validated = $request->validate([
            'ordered_ids' => 'array',
            'ordered_ids.*' => 'integer',
        ]);

        DB::transaction(function () use ($validated, $model) {
            foreach ($validated['ordered_ids'] as $i => $id) {
                $model::whereKey($id)->update(['position' => $i]);
            }
        });
    }
}
