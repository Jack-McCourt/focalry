<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SiteVisit extends Model
{
    use BelongsToStudio, MassPrunable;

    public const UPDATED_AT = null;

    /**
     * Raw page views only power the 30-day analytics screen — the table would
     * otherwise grow forever. Keep 13 months (a year of comparisons + a buffer);
     * pruned daily by the scheduled model:prune.
     */
    public function prunable(): Builder
    {
        return static::withoutGlobalScopes()->where('created_at', '<', now()->subMonths(13));
    }

    protected $fillable = [
        'studio_id',
        'site_id',
        'path',
        'referrer_host',
        'visitor_hash',
        'device',
        'utm_source',
        'utm_medium',
        'utm_campaign',
    ];

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }
}
