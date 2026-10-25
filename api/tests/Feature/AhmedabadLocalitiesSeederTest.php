<?php

namespace Tests\Feature;

use App\Models\Locality;
use Database\Seeders\AhmedabadLocalitiesSeeder;
use Tests\TestCase;

class AhmedabadLocalitiesSeederTest extends TestCase
{
    public function test_adds_missing_areas_without_touching_existing_ones_and_is_rerunnable(): void
    {
        $edited = Locality::factory()->create(['name' => 'Bodakdev', 'slug' => 'bodakdev', 'description' => 'Admin text', 'sort_order' => 3]);
        $typedIn = Locality::factory()->create(['name' => 'shilaj', 'slug' => 'shilaj', 'is_active' => false]);

        $this->seed(AhmedabadLocalitiesSeeder::class);
        $count = Locality::count();

        // Existing rows untouched; no case-insensitive duplicates created.
        $this->assertSame('Admin text', $edited->fresh()->description);
        $this->assertFalse($typedIn->fresh()->is_active);
        $this->assertSame(1, Locality::whereRaw('LOWER(name) = ?', ['shilaj'])->count());
        $this->assertSame(1, Locality::whereRaw('LOWER(name) = ?', ['bodakdev'])->count());

        // New areas are active with unique slugs.
        $this->assertTrue(Locality::where('slug', 'thaltej')->sole()->is_active);
        $this->assertSame(Locality::count(), Locality::distinct()->count('slug'));
        $this->assertGreaterThan(90, $count);

        // Re-running is a no-op.
        $this->seed(AhmedabadLocalitiesSeeder::class);
        $this->assertSame($count, Locality::count());
    }
}
