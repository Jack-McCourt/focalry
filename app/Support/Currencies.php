<?php

namespace App\Support;

class Currencies
{
    /**
     * ISO country code → default ISO currency code (lowercase, matching Stripe convention).
     */
    public const COUNTRY_CURRENCY = [
        'US' => 'usd', 'CA' => 'cad', 'GB' => 'gbp', 'IE' => 'eur', 'AU' => 'aud',
        'NZ' => 'nzd', 'FR' => 'eur', 'DE' => 'eur', 'ES' => 'eur', 'IT' => 'eur',
        'NL' => 'eur', 'BE' => 'eur', 'AT' => 'eur', 'PT' => 'eur', 'FI' => 'eur',
        'GR' => 'eur', 'LU' => 'eur', 'CH' => 'chf', 'SE' => 'sek', 'NO' => 'nok',
        'DK' => 'dkk', 'PL' => 'pln', 'CZ' => 'czk', 'HU' => 'huf', 'RO' => 'ron',
        'JP' => 'jpy', 'CN' => 'cny', 'HK' => 'hkd', 'SG' => 'sgd', 'IN' => 'inr',
        'MY' => 'myr', 'TH' => 'thb', 'ID' => 'idr', 'PH' => 'php', 'KR' => 'krw',
        'AE' => 'aed', 'SA' => 'sar', 'IL' => 'ils', 'ZA' => 'zar', 'MX' => 'mxn',
        'BR' => 'brl', 'AR' => 'ars', 'CL' => 'clp', 'CO' => 'cop',
    ];

    /**
     * Supported currencies: code → display label.
     */
    public const CURRENCIES = [
        'usd' => 'USD — US Dollar',
        'eur' => 'EUR — Euro',
        'gbp' => 'GBP — British Pound',
        'cad' => 'CAD — Canadian Dollar',
        'aud' => 'AUD — Australian Dollar',
        'nzd' => 'NZD — New Zealand Dollar',
        'chf' => 'CHF — Swiss Franc',
        'sek' => 'SEK — Swedish Krona',
        'nok' => 'NOK — Norwegian Krone',
        'dkk' => 'DKK — Danish Krone',
        'pln' => 'PLN — Polish Złoty',
        'czk' => 'CZK — Czech Koruna',
        'huf' => 'HUF — Hungarian Forint',
        'ron' => 'RON — Romanian Leu',
        'jpy' => 'JPY — Japanese Yen',
        'cny' => 'CNY — Chinese Yuan',
        'hkd' => 'HKD — Hong Kong Dollar',
        'sgd' => 'SGD — Singapore Dollar',
        'inr' => 'INR — Indian Rupee',
        'myr' => 'MYR — Malaysian Ringgit',
        'thb' => 'THB — Thai Baht',
        'idr' => 'IDR — Indonesian Rupiah',
        'php' => 'PHP — Philippine Peso',
        'krw' => 'KRW — South Korean Won',
        'aed' => 'AED — UAE Dirham',
        'sar' => 'SAR — Saudi Riyal',
        'ils' => 'ILS — Israeli Shekel',
        'zar' => 'ZAR — South African Rand',
        'mxn' => 'MXN — Mexican Peso',
        'brl' => 'BRL — Brazilian Real',
        'ars' => 'ARS — Argentine Peso',
        'clp' => 'CLP — Chilean Peso',
        'cop' => 'COP — Colombian Peso',
    ];

    public static function forCountry(?string $countryCode): string
    {
        return self::COUNTRY_CURRENCY[strtoupper((string) $countryCode)] ?? 'usd';
    }

    /**
     * @return list<string>
     */
    public static function codes(): array
    {
        return array_keys(self::CURRENCIES);
    }

    public static function isSupported(?string $code): bool
    {
        return $code !== null && array_key_exists(strtolower($code), self::CURRENCIES);
    }
}
