<?php

namespace Tests\Unit;

use App\Support\Money;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class MoneyTest extends TestCase
{
    public function test_parses_and_formats_without_float_errors(): void
    {
        $this->assertSame(1000050, Money::toPaise('10000.50'));
        $this->assertSame(1000000, Money::toPaise(10000));
        $this->assertSame(10, Money::toPaise('0.1'));
        $this->assertSame(-250, Money::toPaise('-2.5'));
        $this->assertSame('10000.50', Money::fromPaise(1000050));
        $this->assertSame('0.05', Money::fromPaise(5));
        $this->assertSame('-2.50', Money::fromPaise(-250));
        // 0.1 + 0.2 must be exactly 0.30.
        $this->assertSame('0.30', Money::fromPaise(Money::toPaise('0.1') + Money::toPaise('0.2')));
    }

    public function test_percentages_round_half_up_to_the_paisa(): void
    {
        $this->assertSame(Money::toPaise('50000'), Money::percentOf(Money::toPaise('5000000'), '1'));
        $this->assertSame(Money::toPaise('12000'), Money::percentOf(Money::toPaise('12000'), '100'));
        $this->assertSame(Money::toPaise('6250.13'), Money::percentOf(Money::toPaise('2500050'), '0.25')); // 6250.125 → 6250.13
        $this->assertSame(Money::toPaise('1.23'), Money::percentOf(Money::toPaise('100'), '1.2345'));
    }

    public function test_split_assigns_rounding_remainder_so_total_is_preserved(): void
    {
        $shares = Money::split(Money::toPaise('100.01'), ['owner' => 50, 'tenant' => 50]);
        $this->assertSame(Money::toPaise('100.01'), array_sum($shares));
    }

    public function test_rejects_garbage(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Money::toPaise('12,000');
    }
}
