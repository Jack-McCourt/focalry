<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuestionnaireTemplate extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = ['studio_id', 'name', 'description', 'questions'];

    protected function casts(): array
    {
        return ['questions' => 'array'];
    }

    /** Seeded once per studio: a sensible wedding-details starter set. */
    public static function seedDefaults(): void
    {
        static::create([
            'name' => 'Wedding details',
            'description' => 'Key details we need to plan your wedding-day coverage.',
            'questions' => [
                ['key' => 'partner_names', 'label' => 'Both of your full names', 'type' => 'text', 'required' => true],
                ['key' => 'ceremony_venue', 'label' => 'Ceremony venue & address', 'type' => 'textarea', 'required' => true],
                ['key' => 'reception_venue', 'label' => 'Reception venue & address', 'type' => 'textarea', 'required' => false],
                ['key' => 'ceremony_time', 'label' => 'Ceremony start time', 'type' => 'text', 'required' => true],
                ['key' => 'guest_count', 'label' => 'Approximate guest count', 'type' => 'text', 'required' => false],
                ['key' => 'getting_ready', 'label' => 'Getting-ready location(s)', 'type' => 'textarea', 'required' => false],
                ['key' => 'planner', 'label' => 'Wedding planner / coordinator contact', 'type' => 'text', 'required' => false],
                ['key' => 'must_have_shots', 'label' => 'Must-have shots or special moments', 'type' => 'textarea', 'required' => false],
                ['key' => 'first_look', 'label' => 'Are you planning a first look?', 'type' => 'checkbox', 'required' => false],
            ],
        ]);
    }
}
