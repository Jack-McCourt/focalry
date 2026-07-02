<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Project;
use App\Models\Studio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Expense tracking + bookkeeping. Pairs with the Reporting module's revenue to
 * give a real profit & loss picture; expenses can be attributed to a project for
 * per-job profitability and flagged billable for costs to rebill.
 */
class ExpenseController extends Controller
{
    public function index(Request $request): Response
    {
        [$from, $to] = $this->range($request);
        $category = trim((string) $request->input('category', ''));
        $projectId = $request->integer('project_id') ?: null;

        $base = Expense::query()
            ->whereBetween('spent_on', [$from->toDateString(), $to->toDateString()])
            ->when($category !== '', fn ($q) => $q->where('category', $category))
            ->when($projectId, fn ($q) => $q->where('project_id', $projectId));

        $expenses = (clone $base)
            ->with('project:id,name')
            ->orderByDesc('spent_on')
            ->orderByDesc('id')
            ->paginate(50)
            ->withQueryString()
            ->through(fn (Expense $e) => [
                'id' => $e->id,
                'spent_on' => $e->spent_on?->toDateString(),
                'category' => $e->category,
                'vendor' => $e->vendor,
                'description' => $e->description,
                'amount_cents' => $e->amount_cents,
                'currency' => $e->currency,
                'project' => $e->project ? ['id' => $e->project->id, 'name' => $e->project->name] : null,
                'billable' => $e->billable,
                'has_receipt' => (bool) $e->receipt_path,
            ]);

        // Totals + per-category breakdown for the whole filtered set (not just the page).
        $byCategory = (clone $base)
            ->selectRaw('category, sum(amount_cents) as cents')
            ->groupBy('category')
            ->orderByDesc('cents')
            ->get()
            ->map(fn ($r) => ['label' => $r->category, 'cents' => (int) $r->cents])
            ->all();

        return Inertia::render('Expenses/Index', [
            'currency' => $this->currency(),
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'filters' => ['category' => $category, 'project_id' => $projectId],
            'expenses' => $expenses,
            'total_cents' => (int) (clone $base)->sum('amount_cents'),
            'byCategory' => $byCategory,
            'categories' => Expense::CATEGORIES,
            'projects' => Project::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateExpense($request);
        $data['receipt_path'] = $this->storeReceipt($request);

        Expense::create($data);

        return back()->with('success', 'Expense added.');
    }

    public function update(Request $request, Expense $expense): RedirectResponse
    {
        $data = $this->validateExpense($request);

        if ($request->hasFile('receipt')) {
            $this->deleteReceipt($expense);
            $data['receipt_path'] = $this->storeReceipt($request);
        }

        $expense->update($data);

        return back()->with('success', 'Expense updated.');
    }

    public function destroy(Expense $expense): RedirectResponse
    {
        $this->deleteReceipt($expense);
        $expense->delete();

        return back()->with('success', 'Expense deleted.');
    }

    /** Redirect to a short-lived signed URL for the (private) receipt. */
    public function receipt(Expense $expense): RedirectResponse
    {
        abort_unless($expense->receipt_path, 404);

        return redirect()->away(
            Storage::disk('wasabi')->temporaryUrl($expense->receipt_path, now()->addMinutes(5))
        );
    }

    public function export(Request $request): StreamedResponse
    {
        [$from, $to] = $this->range($request);
        $rows = Expense::query()
            ->whereBetween('spent_on', [$from->toDateString(), $to->toDateString()])
            ->with('project:id,name')
            ->orderBy('spent_on')
            ->get();

        $filename = "expenses_{$from->toDateString()}_{$to->toDateString()}.csv";

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Date', 'Category', 'Vendor', 'Description', 'Project', 'Billable', 'Amount']);
            foreach ($rows as $e) {
                fputcsv($out, [
                    $e->spent_on?->toDateString(),
                    $e->category,
                    $e->vendor,
                    $e->description,
                    $e->project?->name,
                    $e->billable ? 'Yes' : 'No',
                    number_format($e->amount_cents / 100, 2, '.', ''),
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    /** @return array<string, mixed> */
    private function validateExpense(Request $request): array
    {
        $data = $request->validate([
            'spent_on' => 'required|date',
            'category' => 'required|string|max:255',
            'vendor' => 'nullable|string|max:255',
            'description' => 'nullable|string|max:500',
            'amount_cents' => 'required|integer|min:0',
            'currency' => ['required', 'string', 'size:3'],
            'project_id' => ['nullable', Rule::exists('projects', 'id')->where('studio_id', app('current.studio.id'))],
            'billable' => 'boolean',
            'notes' => 'nullable|string|max:5000',
            'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf,webp,heic|max:10240',
        ]);

        // The file is handled separately and isn't a model attribute.
        unset($data['receipt']);

        return $data;
    }

    /** Store the uploaded receipt privately (outside the public/ prefix). */
    private function storeReceipt(Request $request): ?string
    {
        if (! $request->hasFile('receipt')) {
            return null;
        }

        $studioId = app('current.studio.id');

        return $request->file('receipt')->store("studios/{$studioId}/expenses/receipts", 'wasabi') ?: null;
    }

    private function deleteReceipt(Expense $expense): void
    {
        if ($expense->receipt_path) {
            Storage::disk('wasabi')->delete($expense->receipt_path);
        }
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function range(Request $request): array
    {
        $to = $this->parseDate($request->input('to')) ?? Carbon::today();
        $from = $this->parseDate($request->input('from')) ?? $to->copy()->startOfYear();

        if ($from->gt($to)) {
            [$from, $to] = [$to->copy(), $from->copy()];
        }

        return [$from->startOfDay(), $to->endOfDay()];
    }

    private function parseDate(?string $value): ?Carbon
    {
        if (! $value) {
            return null;
        }
        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function currency(): string
    {
        return Studio::find(app('current.studio.id'))?->default_currency ?? 'gbp';
    }
}
