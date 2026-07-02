<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Meeting;
use App\Models\Project;
use App\Models\Studio;
use App\Models\Task;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The studio's single calendar surface: meetings, project shoot dates, payment
 * due dates and task deadlines overlaid on one month grid. Read-only — each
 * event deep-links to the record it came from. Dates are resolved in the
 * studio's scheduling timezone so a meeting lands on the right day.
 */
class CalendarController extends Controller
{
    public function index(Request $request): Response
    {
        $studio = $this->studio();
        $tz = $studio?->effectiveTimezone() ?? config('app.timezone');
        $month = $this->parseMonth($request->input('month'), $tz);

        // The visible grid runs Monday-before-the-1st to Sunday-after-the-last.
        $gridStart = $month->copy()->startOfMonth()->startOfWeek(Carbon::MONDAY);
        $gridEnd = $month->copy()->endOfMonth()->endOfWeek(Carbon::SUNDAY);

        $events = collect()
            ->concat($this->meetings($gridStart, $gridEnd, $tz))
            ->concat($this->shoots($gridStart, $gridEnd))
            ->concat($this->payments($gridStart, $gridEnd))
            ->concat($this->tasks($gridStart, $gridEnd))
            ->values()
            ->all();

        return Inertia::render('Calendar/Index', [
            'month' => $month->format('Y-m'),
            'prev' => $month->copy()->subMonth()->format('Y-m'),
            'next' => $month->copy()->addMonth()->format('Y-m'),
            'today' => Carbon::now($tz)->toDateString(),
            'events' => $events,
            'calendar' => [
                'connected' => (bool) $studio?->googleCalendarConnected(),
                'email' => $studio?->google_calendar_email,
            ],
        ]);
    }

    /** @return array<int, array<string, mixed>> */
    private function meetings(Carbon $start, Carbon $end, string $tz): array
    {
        return Meeting::query()
            ->whereIn('status', Meeting::ACTIVE_STATUSES)
            ->whereBetween('starts_at', [$start->copy()->startOfDay(), $end->copy()->endOfDay()])
            ->with(['contact:id,first_name,last_name', 'meetingType:id,name'])
            ->get()
            ->map(function (Meeting $m) use ($tz) {
                $local = $m->starts_at->copy()->setTimezone($tz);

                return [
                    'date' => $local->toDateString(),
                    'type' => 'meeting',
                    'title' => $m->meetingType?->name ?? 'Meeting',
                    'subtitle' => $m->contact?->name ?? $m->client_name,
                    'time' => $local->format('g:ia'),
                    'color' => $m->status === 'pending' ? '#f59e0b' : '#3b82f6',
                    'url' => route('meetings.index'),
                ];
            })->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function shoots(Carbon $start, Carbon $end): array
    {
        return Project::query()
            ->whereNotNull('event_date')
            ->whereBetween('event_date', [$start->toDateString(), $end->toDateString()])
            ->with(['type:id,label,color', 'contact:id,first_name,last_name'])
            ->get()
            ->map(fn (Project $p) => [
                'date' => $p->event_date->toDateString(),
                'type' => 'shoot',
                'title' => $p->name,
                'subtitle' => $p->type?->label ?? $p->contact?->name,
                'time' => null,
                'color' => $p->type?->color ?? '#8b5cf6',
                'url' => route('projects.index', ['open' => $p->id]),
            ])->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function payments(Carbon $start, Carbon $end): array
    {
        $today = Carbon::today();

        return Invoice::query()
            ->where('status', '!=', 'void')
            ->with(['schedules', 'contact:id,first_name,last_name'])
            ->get()
            ->flatMap(function (Invoice $invoice) use ($start, $end, $today) {
                return collect($invoice->reminderTargets())
                    ->filter(fn ($t) => $t['due_date']->betweenIncluded($start, $end))
                    ->map(fn ($t) => [
                        'date' => $t['due_date']->toDateString(),
                        'type' => 'payment',
                        'title' => Money::format((int) $t['amount_cents'], $invoice->currency).' due',
                        'subtitle' => $invoice->contact?->name ?? "Invoice {$invoice->number}",
                        'time' => null,
                        'color' => $t['due_date']->lt($today) ? '#ef4444' : '#10b981',
                        'url' => route('invoices.show', $invoice->id),
                    ]);
            })->values()->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function tasks(Carbon $start, Carbon $end): array
    {
        return Task::query()
            ->whereNull('completed_at')
            ->whereNotNull('due_date')
            ->whereBetween('due_date', [$start->toDateString(), $end->toDateString()])
            ->with('project:id,name')
            ->get()
            ->map(fn (Task $t) => [
                'date' => $t->due_date->toDateString(),
                'type' => 'task',
                'title' => $t->title,
                'subtitle' => $t->project?->name,
                'time' => null,
                'color' => '#6366f1',
                'url' => route('tasks.index'),
            ])->all();
    }

    private function parseMonth(?string $value, string $tz): Carbon
    {
        if ($value && preg_match('/^\d{4}-\d{2}$/', $value)) {
            try {
                return Carbon::createFromFormat('Y-m', $value, $tz)->startOfMonth();
            } catch (\Throwable) {
                // fall through to current month
            }
        }

        return Carbon::now($tz)->startOfMonth();
    }

    private function studio(): ?Studio
    {
        return Studio::find(app('current.studio.id'));
    }
}
