<?php

namespace App\Support;

class Money
{
    /** @var array<string, string> */
    private const SYMBOLS = [
        'usd' => '$', 'gbp' => '£', 'eur' => '€', 'aud' => 'A$', 'cad' => 'C$',
        'nzd' => 'NZ$', 'jpy' => '¥', 'inr' => '₹', 'zar' => 'R', 'chf' => 'CHF ',
        'sek' => 'kr ', 'nok' => 'kr ', 'dkk' => 'kr ', 'sgd' => 'S$', 'hkd' => 'HK$',
    ];

    /** Format integer minor units (cents) with the currency symbol. */
    public static function format(int $cents, string $currency): string
    {
        $code = strtolower($currency);
        $symbol = self::SYMBOLS[$code] ?? strtoupper($currency).' ';
        $decimals = $code === 'jpy' ? 0 : 2;

        return $symbol.number_format($cents / 100, $decimals);
    }
}
