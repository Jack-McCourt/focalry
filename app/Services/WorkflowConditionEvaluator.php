<?php

namespace App\Services;

use App\Models\Project;
use App\Models\Workflow;
use Illuminate\Support\Carbon;

/**
 * Decides whether a project satisfies a workflow's "if" conditions.
 *
 * Conditions gate a workflow after its trigger fires — e.g. the trigger is
 * "project moves to Booked" and a condition narrows it to "type is Wedding".
 * Each condition is {field, operator, value}; built-in fields cover the
 * project's type/status/event date/name, and `cf:<key>` reaches into the
 * project's custom fields so studios can branch on anything they track.
 */
class WorkflowConditionEvaluator
{
    /** Prefix that marks a condition field as a custom field key. */
    public const CUSTOM_FIELD_PREFIX = 'cf:';

    public function passes(Workflow $workflow, Project $project): bool
    {
        $conditions = $workflow->conditions ?? [];

        // No conditions means the workflow always runs once triggered.
        if ($conditions === []) {
            return true;
        }

        $matchAny = ($workflow->condition_match ?? 'all') === 'any';

        foreach ($conditions as $condition) {
            $result = $this->evaluate($condition, $project);

            if ($matchAny && $result) {
                return true;
            }
            if (! $matchAny && ! $result) {
                return false;
            }
        }

        // ALL: nothing failed. ANY: nothing matched.
        return ! $matchAny;
    }

    /**
     * @param  array<string, mixed>  $condition
     */
    private function evaluate(array $condition, Project $project): bool
    {
        $actual = $this->resolveField($condition['field'] ?? '', $project);
        $operator = $condition['operator'] ?? 'equals';
        $expected = $condition['value'] ?? null;

        // Date conditions carry a relative offset ({amount, unit, anchor}) rather
        // than a fixed date — e.g. "is after 2 weeks from now".
        if (is_array($expected) && isset($expected['unit'])) {
            return $this->evaluateRelativeDate($actual, $operator, $expected);
        }

        return match ($operator) {
            'equals' => $this->normalise($actual) === $this->normalise($expected),
            'not_equals' => $this->normalise($actual) !== $this->normalise($expected),
            'contains' => $expected !== null && $expected !== ''
                && str_contains(mb_strtolower((string) $actual), mb_strtolower((string) $expected)),
            'greater_than' => $this->isFilled($actual) && is_numeric($expected) && (float) $actual > (float) $expected,
            'less_than' => $this->isFilled($actual) && is_numeric($expected) && (float) $actual < (float) $expected,
            'is_set' => $this->isFilled($actual),
            'is_not_set' => ! $this->isFilled($actual),
            default => false,
        };
    }

    /**
     * Compare a date field against an anchor that's a number of days/weeks/months
     * before ('past') or after ('future') today. Operators read as after/before.
     *
     * @param  array<string, mixed>  $spec
     */
    private function evaluateRelativeDate(mixed $actual, string $operator, array $spec): bool
    {
        if (! $this->isFilled($actual)) {
            return false;
        }

        try {
            $date = Carbon::parse($actual)->startOfDay();
        } catch (\Throwable) {
            return false;
        }

        $amount = max(0, (int) ($spec['amount'] ?? 0));
        $unit = in_array($spec['unit'] ?? 'day', ['day', 'week', 'month'], true) ? $spec['unit'] : 'day';
        $anchor = ($spec['anchor'] ?? 'future') === 'past'
            ? Carbon::today()->sub($unit, $amount)
            : Carbon::today()->add($unit, $amount);

        return match ($operator) {
            'greater_than' => $date->gt($anchor),
            'less_than' => $date->lt($anchor),
            'equals' => $date->eq($anchor),
            'not_equals' => ! $date->eq($anchor),
            default => false,
        };
    }

    /** Pull the comparable value for a condition field off the project. */
    private function resolveField(string $field, Project $project): mixed
    {
        if (str_starts_with($field, self::CUSTOM_FIELD_PREFIX)) {
            $key = substr($field, strlen(self::CUSTOM_FIELD_PREFIX));

            return ($project->custom_fields ?? [])[$key] ?? null;
        }

        return match ($field) {
            'type' => $project->type_id,
            'status' => $project->status_id,
            'name' => $project->name,
            'event_date' => $project->event_date?->toDateString(),
            default => null,
        };
    }

    /** Loose, case-insensitive scalar comparison so "1" == 1 and "Yes" == "yes". */
    private function normalise(mixed $value): string
    {
        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        return mb_strtolower(trim((string) ($value ?? '')));
    }

    private function isFilled(mixed $value): bool
    {
        if (is_array($value)) {
            return $value !== [];
        }

        return $value !== null && $value !== '';
    }
}
