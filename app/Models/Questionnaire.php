<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Questionnaire extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = [
        'studio_id',
        'project_id',
        'contact_id',
        'questionnaire_template_id',
        'title',
        'status',
        'questions',
        'answers',
        'sent_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'questions' => 'array',
            'answers' => 'array',
            'sent_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Questionnaire $q) {
            if (empty($q->public_id)) {
                $q->public_id = (string) Str::uuid();
            }
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(QuestionnaireTemplate::class, 'questionnaire_template_id');
    }
}
