<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * INR money helpers working in integer paise so no floating point is ever
 * involved in brokerage or payment arithmetic.
 */
final class Money
{
    /** Parse "12345", "12345.5", "12345.50" (or int) into paise. */
    public static function toPaise(string|int|float|null $value): int
    {
        if ($value === null || $value === '') {
            return 0;
        }
        if (is_int($value)) {
            return $value * 100;
        }
        if (is_float($value)) {
            // Only reached for values coming from validated numeric input.
            $value = number_format($value, 2, '.', '');
        }

        $value = trim((string) $value);
        if (! preg_match('/^(-)?(\d+)(?:\.(\d{1,2})\d*)?$/', $value, $m)) {
            throw new InvalidArgumentException("Invalid money value [{$value}].");
        }

        $paise = ((int) $m[2]) * 100 + (int) str_pad($m[3] ?? '0', 2, '0');

        return $m[1] === '-' ? -$paise : $paise;
    }

    /** Format paise as a DECIMAL(14,2) string, e.g. 1000050 => "10000.50". */
    public static function fromPaise(int $paise): string
    {
        $sign = $paise < 0 ? '-' : '';
        $abs = abs($paise);

        return $sign.intdiv($abs, 100).'.'.str_pad((string) ($abs % 100), 2, '0', STR_PAD_LEFT);
    }

    /**
     * Apply a percentage (up to 4 decimals) to an amount in paise, rounding
     * half up to the nearest paisa.
     */
    public static function percentOf(int $paise, string|float $percentage): int
    {
        $basisPoints = self::percentageToMicro((string) $percentage); // percentage * 10_000
        $numerator = $paise * $basisPoints;
        $denominator = 100 * 10_000;

        return intdiv($numerator + intdiv($denominator, 2), $denominator);
    }

    /** Split an amount by integer/decimal share percentages, assigning rounding remainder to the first share. */
    public static function split(int $paise, array $shares): array
    {
        $result = [];
        $allocated = 0;
        foreach ($shares as $key => $share) {
            $result[$key] = self::percentOf($paise, (string) $share);
            $allocated += $result[$key];
        }
        if ($result !== []) {
            $first = array_key_first($result);
            $result[$first] += $paise - $allocated;
        }

        return $result;
    }

    public static function format(int $paise): string
    {
        return '₹'.number_format($paise / 100, 2);
    }

    private static function percentageToMicro(string $percentage): int
    {
        if (! preg_match('/^(\d+)(?:\.(\d{1,4})\d*)?$/', trim($percentage), $m)) {
            throw new InvalidArgumentException("Invalid percentage [{$percentage}].");
        }

        return ((int) $m[1]) * 10_000 + (int) str_pad($m[2] ?? '0', 4, '0');
    }
}
