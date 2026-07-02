<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    use BelongsToStudio, HasFactory;

    /** Suggested categories for photography businesses (free-text is still allowed). */
    public const CATEGORIES = [
        'Equipment',
        'Software & subscriptions',
        'Travel & mileage',
        'Second shooter / assistant',
        'Props & styling',
        'Studio / venue rental',
        'Albums & prints (COGS)',
        'Marketing & advertising',
        'Insurance',
        'Education & training',
        'Office & admin',
        'Bank & payment fees',
        'Other',
    ];

    protected $fillable = [
        'studio_id',
        'project_id',
        'spent_on',
        'category',
        'vendor',
        'description',
        'amount_cents',
        'currency',
        'receipt_path',
        'billable',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'spent_on' => 'date',
            'amount_cents' => 'integer',
            'billable' => 'boolean',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
