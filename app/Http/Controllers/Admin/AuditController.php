<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditController extends Controller
{
    public function index(Request $request): Response
    {
        $action = $request->string('action')->toString();

        $logs = AdminAuditLog::query()
            ->with('user:id,name,email')
            ->when($action !== '', fn ($q) => $q->where('action', $action))
            ->latest()
            ->paginate(50)
            ->withQueryString()
            ->through(fn (AdminAuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'description' => $log->description,
                'actor' => $log->user ? $log->user->name : 'System',
                'ip' => $log->ip,
                'meta' => $log->meta,
                'created_at' => $log->created_at?->toIso8601String(),
            ]);

        return Inertia::render('Admin/Audit', [
            'logs' => $logs,
            'filters' => ['action' => $action],
            'actions' => AdminAuditLog::query()->distinct()->orderBy('action')->pluck('action'),
        ]);
    }
}
