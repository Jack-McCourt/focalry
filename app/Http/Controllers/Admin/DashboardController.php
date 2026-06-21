<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Studio;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        $tiers = config('plans.tiers');

        // Studios per plan.
        $planCounts = Studio::query()
            ->select('plan', DB::raw('count(*) as count'))
            ->groupBy('plan')
            ->pluck('count', 'plan');

        // Estimated MRR from configured monthly prices (minor units).
        $mrr = 0;
        foreach ($planCounts as $plan => $count) {
            $mrr += (int) ($tiers[$plan]['price'] ?? 0) * (int) $count;
        }

        $plans = collect(config('plans.order'))->map(fn (string $key) => [
            'key' => $key,
            'name' => $tiers[$key]['name'],
            'count' => (int) ($planCounts[$key] ?? 0),
        ])->values();

        return Inertia::render('Admin/Dashboard', [
            'currency' => config('plans.currency', 'gbp'),
            'stats' => [
                'studios' => Studio::count(),
                'suspended' => Studio::whereNotNull('suspended_at')->count(),
                'users' => User::count(),
                'storage_used' => (int) Studio::sum('storage_used'),
                'mrr_cents' => $mrr,
                'gmv_cents' => (int) Order::withoutGlobalScopes()
                    ->whereNotIn('status', ['pending', 'cancelled'])
                    ->sum('total_cents'),
                'orders' => Order::withoutGlobalScopes()->whereNotIn('status', ['pending', 'cancelled'])->count(),
            ],
            'plans' => $plans,
            'recentStudios' => Studio::latest()->limit(8)->get()->map(fn (Studio $s) => [
                'id' => $s->id,
                'name' => $s->name,
                'email' => $s->email,
                'plan' => $s->planKey(),
                'created_at' => $s->created_at?->toIso8601String(),
            ]),
        ]);
    }
}
