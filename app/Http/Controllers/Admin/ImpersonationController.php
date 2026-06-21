<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ImpersonationController extends Controller
{
    /**
     * Begin impersonating a studio user. Guarded by the `admin` middleware,
     * so only a super admin (not already impersonating) can reach this.
     */
    public function start(Request $request, User $user): RedirectResponse
    {
        $admin = $request->user();

        if ($user->is($admin)) {
            return back()->with('error', 'You cannot impersonate yourself.');
        }

        // Remember who we really are so we can switch back.
        $request->session()->put('impersonator_id', $admin->id);

        AdminAuditLog::record(
            'impersonate.start',
            $user,
            "{$admin->name} started impersonating {$user->name} ({$user->studio->name})",
            ['studio_id' => $user->studio_id],
            $admin->id,
        );

        Auth::login($user);

        return redirect()->route('dashboard')
            ->with('success', "You are now viewing the app as {$user->name} ({$user->studio->name}).");
    }

    /**
     * Stop impersonating and return to the original super admin account.
     * Only requires auth — the session's impersonator_id is the authority.
     */
    public function stop(Request $request): RedirectResponse
    {
        $impersonatorId = $request->session()->pull('impersonator_id');

        if (! $impersonatorId) {
            return redirect()->route('dashboard');
        }

        $admin = User::find($impersonatorId);

        if ($admin && $admin->isSuperAdmin()) {
            AdminAuditLog::record(
                'impersonate.stop',
                $request->user(),
                "{$admin->name} stopped impersonating {$request->user()->name}",
                [],
                $admin->id,
            );

            Auth::login($admin);

            return redirect()->route('admin.dashboard')
                ->with('success', 'Returned to your admin account.');
        }

        // Safety: if the original admin is gone or no longer privileged, log out.
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
