<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\ContractTemplate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ContractTemplateController extends Controller
{
    public function index(): Response
    {
        if (ContractTemplate::count() === 0) {
            ContractTemplate::seedDefaults();
        }

        return Inertia::render('Contracts/Templates/Index', [
            'templates' => ContractTemplate::orderBy('name')->get(['id', 'name', 'fields', 'updated_at'])
                ->map(fn (ContractTemplate $t) => [
                    'id' => $t->id,
                    'name' => $t->name,
                    'field_count' => count($t->fields ?? []),
                    'updated_at' => $t->updated_at->toDateString(),
                ]),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Contracts/Templates/Create');
    }

    public function store(Request $request): RedirectResponse
    {
        ContractTemplate::create($this->validateTemplate($request));

        return redirect()->route('contracts.templates.index')->with('success', 'Template created.');
    }

    public function edit(ContractTemplate $template): Response
    {
        return Inertia::render('Contracts/Templates/Edit', [
            'template' => $template->only(['id', 'name', 'body', 'fields']),
        ]);
    }

    public function update(Request $request, ContractTemplate $template): RedirectResponse
    {
        $template->update($this->validateTemplate($request));

        return redirect()->route('contracts.templates.index')->with('success', 'Template updated.');
    }

    public function destroy(ContractTemplate $template): RedirectResponse
    {
        $template->delete();

        return redirect()->route('contracts.templates.index')->with('success', 'Template deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateTemplate(Request $request): array
    {
        return $request->validate([
            'name' => 'required|string|max:255',
            'body' => 'nullable|string',
            'fields' => 'array',
            'fields.*.key' => 'required|string|max:60',
            'fields.*.label' => 'required|string|max:255',
            'fields.*.type' => ['required', Rule::in(['text', 'multiline', 'date', 'checkbox', 'invoice'])],
            'fields.*.fill_by' => ['required', Rule::in(['studio', 'client'])],
            'fields.*.value' => 'nullable',
        ]);
    }
}
