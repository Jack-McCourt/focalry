<?php

namespace Database\Factories;

use App\Models\Studio;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Studio>
 */
class StudioFactory extends Factory
{
    protected $model = Studio::class;

    public function definition(): array
    {
        $name = fake()->company().' Photography';

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::random(4),
            'email' => fake()->unique()->companyEmail(),
            'plan' => 'free',
            'commission_rate' => 15,
            'default_currency' => 'usd',
        ];
    }

    public function onPaidPlan(string $plan = 'plus'): static
    {
        return $this->state([
            'plan' => $plan,
            'commission_rate' => 0,
        ]);
    }
}
