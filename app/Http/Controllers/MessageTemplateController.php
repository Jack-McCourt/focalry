<?php

namespace App\Http\Controllers;

use App\Models\MessageTemplate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class MessageTemplateController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'body' => 'required|string|max:20000',
        ]);

        MessageTemplate::create($data);

        return back()->with('success', 'Template saved.');
    }

    public function update(Request $request, MessageTemplate $template): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'body' => 'required|string|max:20000',
        ]);

        $template->update($data);

        return back()->with('success', 'Template updated.');
    }

    public function destroy(MessageTemplate $template): RedirectResponse
    {
        $template->delete();

        return back()->with('success', 'Template deleted.');
    }
}
