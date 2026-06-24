<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SiteVisit extends Model
{
    use BelongsToStudio;

    public const UPDATED_AT = null;

    protected $fillable = [
        'studio_id',
        'site_id',
        'path',
        'referrer_host',
    ];

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }
}
