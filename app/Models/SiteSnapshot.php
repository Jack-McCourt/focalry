<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A published version of the website (the builder payload that went live) —
 *  restorable into the draft for one-click rollback. Capped per site. */
class SiteSnapshot extends Model
{
    use BelongsToStudio;

    protected $fillable = ['studio_id', 'site_id', 'payload'];

    protected function casts(): array
    {
        return ['payload' => 'array'];
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }
}
