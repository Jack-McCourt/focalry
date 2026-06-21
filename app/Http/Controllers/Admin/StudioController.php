<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\Collection;
use App\Models\Order;
use App\Models\Studio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StudioController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->toString();

        $studios = Studio::query()
            ->withCount('users')
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('name', 'ilike', "%{$search}%")
                ->orWhere('email', 'ilike', "%{$search}%")
                ->orWhere('slug', 'ilike', "%{$search}%")))
            ->latest()
            ->paginate(25)
            ->withQueryString()
            ->through(fn (Studio $s) => [
                'id' => $s->id,
                'name' => $s->name,
                'email' => $s->email,
                'plan' => $s->planKey(),
                'users_count' => $s->users_count,
                'storage_used' => (int) $s->storage_used,
                'storage_limit' => $s->storageLimit(),
                'suspended' => $s->isSuspended(),
                'created_at' => $s->created_at?->toIso8601String(),
            ]);

        return Inertia::render('Admin/Studios/Index', [
            'studios' => $studios,
            'filters' => ['search' => $search],
            'plans' => $this->planOptions(),
        ]);
    }

    public function show(Studio $studio): Response
    {
        $studio->loadCount('users');
        $subscription = $studio->subscription('default');

        return Inertia::render('Admin/Studios/Show', [
            'studio' => [
                'id' => $studio->id,
                'name' => $studio->name,
                'email' => $studio->email,
                'slug' => $studio->slug,
                'plan' => $studio->planKey(),
                'commission_rate' => (int) $studio->commission_rate,
                'effective_commission' => $studio->effectiveCommissionRate(),
                'storage_used' => (int) $studio->storage_used,
                'storage_limit' => $studio->storageLimit(),
                'storage_limit_override_gb' => $studio->storage_limit_override !== null
                    ? round($studio->storage_limit_override / 1024 ** 3, 2)
                    : null,
                'suspended_at' => $studio->suspended_at?->toIso8601String(),
                'created_at' => $studio->created_at?->toIso8601String(),
                'custom_domain' => $studio->custom_domain,
                'default_currency' => $studio->default_currency,
                'users_count' => $studio->users_count,
                'subscription' => $subscription ? [
                    'status' => $subscription->stripe_status,
                    'active' => $subscription->valid(),
                ] : null,
            ],
            'users' => $studio->users()->get(['id', 'name', 'email', 'role'])->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
            ]),
            'counts' => [
                'collections' => Collection::withoutGlobalScopes()->where('studio_id', $studio->id)->count(),
                'orders' => Order::withoutGlobalScopes()->where('studio_id', $studio->id)->count(),
            ],
            'plans' => $this->planOptions(),
            'currency' => config('plans.currency', 'gbp'),
        ]);
    }

    public function update(Request $request, Studio $studio): RedirectResponse
    {
        $validated = $request->validate([
            'plan' => 'required|string|in:'.implode(',', config('plans.order')),
            'commission_rate' => 'required|integer|min:0|max:100',
            // Storage override in GB; blank/null = use the plan's included storage.
            'storage_limit_gb' => 'nullable|numeric|min:0|max:1048576',
        ]);

        $before = $studio->only(['plan', 'commission_rate', 'storage_limit_override']);

        $override = $validated['storage_limit_gb'] === null || $validated['storage_limit_gb'] === ''
            ? null
            : (int) round((float) $validated['storage_limit_gb'] * 1024 ** 3);

        // Admin override: sets the cached plan directly. If the studio has a live
        // Stripe subscription, change it via Stripe instead to avoid divergence.
        $studio->update([
            'plan' => $validated['plan'],
            'commission_rate' => $validated['commission_rate'],
            'storage_limit_override' => $override,
        ]);

        AdminAuditLog::record(
            'studio.update',
            $studio,
            "Updated {$studio->name}",
            ['before' => $before, 'after' => $studio->only(['plan', 'commission_rate', 'storage_limit_override'])],
        );

        return back()->with('success', 'Studio updated.');
    }

    public function suspend(Studio $studio): RedirectResponse
    {
        $studio->update(['suspended_at' => $studio->isSuspended() ? null : now()]);
        $nowSuspended = $studio->isSuspended();

        AdminAuditLog::record(
            $nowSuspended ? 'studio.suspend' : 'studio.reinstate',
            $studio,
            ($nowSuspended ? 'Suspended ' : 'Reinstated ').$studio->name,
        );

        return back()->with('success', $nowSuspended ? 'Studio suspended.' : 'Studio reinstated.');
    }

    public function destroy(Studio $studio): RedirectResponse
    {
        AdminAuditLog::record('studio.delete', null, "Deleted studio {$studio->name}", [
            'studio_id' => $studio->id,
            'name' => $studio->name,
            'email' => $studio->email,
        ]);

        $studio->delete();

        return redirect()->route('admin.studios.index')->with('success', 'Studio deleted.');
    }

    /** @return list<array{key:string,name:string}> */
    private function planOptions(): array
    {
        return collect(config('plans.order'))
            ->map(fn (string $key) => ['key' => $key, 'name' => config("plans.tiers.$key.name")])
            ->values()
            ->all();
    }
}
