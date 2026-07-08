<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A newsletter signup captured by the website's newsletter block. */
class SiteSubscriber extends Model
{
    use BelongsToStudio;

    protected $fillable = [
        'studio_id',
        'site_id',
        'email',
        'name',
        'source',
    ];

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }
}
