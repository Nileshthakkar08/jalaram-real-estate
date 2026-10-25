<?php

namespace Database\Seeders;

use App\Models\Locality;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Residential areas of Ahmedabad (plus a few adjoining towns buyers commonly search for).
 * Safe for production and safe to re-run: existing localities — matched by name, ignoring
 * case — are never modified, so admin edits and deactivations are preserved.
 *
 *   php artisan db:seed --class=AhmedabadLocalitiesSeeder --force
 */
class AhmedabadLocalitiesSeeder extends Seeder
{
    /** Grouped by zone; order within the list becomes the dropdown order for new entries. */
    private const AREAS = [
        // West
        'Ambawadi', 'Ambli', 'Ashram Road', 'Bodakdev', 'Ellisbridge', 'Gulbai Tekra', 'Gurukul', 'Iscon',
        'Jodhpur', 'Judges Bungalow Road', 'Makarba', 'Memnagar', 'Navrangpura', 'Nehru Nagar', 'Paldi',
        'Prahlad Nagar', 'Satellite', 'SG Highway', 'Shivranjani', 'Shyamal', 'Sindhu Bhavan Road', 'Thaltej',
        'Usmanpura', 'Vastrapur', 'Vasna', 'Vejalpur',
        // North-west / new west
        'Bhadaj', 'Bhuyangdev', 'Bopal', 'Chandlodia', 'Ghatlodia', 'Ghuma', 'Gota', 'Hebatpur', 'Jagatpur',
        'Manipur', 'Naranpura', 'Ognaj', 'Sarkhej', 'Science City', 'Shantipura', 'Shela', 'Shilaj', 'Sola',
        'South Bopal', 'Sughad', 'Telav', 'Tragad', 'Vaishnodevi Circle', 'Zundal',
        // North
        'Chandkheda', 'Kali', 'Motera', 'Nava Vadaj', 'New Ranip', 'Ranip', 'Sabarmati', 'Vadaj', 'Koteshwar', 'Bhat',
        // Central / old city
        'Asarwa', 'Dariyapur', 'Jamalpur', 'Kalupur', 'Khadia', 'Lal Darwaja', 'Raipur', 'Shahibaug', 'Shahpur',
        // East
        'Amraiwadi', 'Bapunagar', 'CTM', 'Gomtipur', 'Hansol', 'Khokhra', 'Krishnanagar', 'Kubernagar',
        'Meghaninagar', 'Naroda', 'Nava Naroda', 'Nikol', 'Odhav', 'Ramol', 'Rakhial', 'Sardarnagar', 'Saraspur',
        'Thakkarbapa Nagar', 'Vastral', 'Viratnagar', 'Chiloda', 'Kathwada',
        // South
        'Behrampura', 'Danilimda', 'Ghodasar', 'Hathijan', 'Isanpur', 'Jashodanagar', 'Kankaria', 'Lambha',
        'Maninagar', 'Narol', 'Vatva', 'Vinzol', 'Aslali',
        // Adjoining towns often searched with Ahmedabad
        'Adalaj', 'Changodar', 'Sanand',
    ];

    public function run(): void
    {
        $existing = Locality::query()->pluck('name')->map(fn ($n) => mb_strtolower($n))->flip();
        $order = (int) Locality::query()->max('sort_order');
        $added = [];

        foreach (self::AREAS as $name) {
            if ($existing->has(mb_strtolower($name))) {
                continue;
            }

            $slug = Str::slug($name);
            for ($i = 2; Locality::query()->where('slug', $slug)->exists(); $i++) {
                $slug = Str::slug($name)."-{$i}";
            }

            Locality::create(['name' => $name, 'slug' => $slug, 'city' => 'Ahmedabad', 'is_active' => true, 'sort_order' => ++$order]);
            $existing->put(mb_strtolower($name), true);
            $added[] = $name;
        }

        $inactive = Locality::query()->where('is_active', false)->orderBy('name')->pluck('name');

        $this->command?->info(count($added).' localities added'.($added ? ': '.implode(', ', $added) : '.'));
        if ($inactive->isNotEmpty()) {
            $this->command?->warn('Inactive (not shown publicly until activated in /admin/localities): '.$inactive->implode(', '));
        }
    }
}
