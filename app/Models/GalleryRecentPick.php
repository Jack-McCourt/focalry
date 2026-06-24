<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A studio's recently-used gallery photo (via the website-builder "From
 * galleries" picker). One row per distinct photo, with used_at bumped on reuse.
 */
class GalleryRecentPick extends Model
{
    use BelongsToStudio;

    public $timestamps = false;

    protected $fillable = ['studio_id', 'photo_id', 'used_at'];

    protected $casts = ['used_at' => 'datetime'];

    public function photo(): BelongsTo
    {
        return $this->belongsTo(Photo::class);
    }

    /** Record that a photo was just used, creating or refreshing its entry. */
    public static function touchPhoto(int $photoId): void
    {
        static::updateOrCreate(['photo_id' => $photoId], ['used_at' => now()]);
    }
}
