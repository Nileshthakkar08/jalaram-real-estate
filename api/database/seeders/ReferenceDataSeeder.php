<?php

namespace Database\Seeders;

use App\Models\Amenity;
use App\Models\Locality;
use App\Models\Setting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Reference data that is safe in every environment: Ahmedabad localities, amenities and
 * empty settings keys. Contact settings are left blank on purpose — admins enter the real
 * details, and the website hides anything that is empty.
 */
class ReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        $localities = [
            'Bodakdev', 'Prahlad Nagar', 'Satellite', 'Vastrapur', 'Thaltej', 'SG Highway', 'Bopal', 'South Bopal',
            'Shela', 'Gota', 'Chandkheda', 'Navrangpura', 'Maninagar', 'Science City', 'Ambli', 'Naranpura',
        ];
        foreach ($localities as $i => $name) {
            Locality::firstOrCreate(['slug' => Str::slug($name)], ['name' => $name, 'city' => 'Ahmedabad', 'sort_order' => $i]);
        }

        $amenities = [
            'Lift', 'Parking', 'Power Backup', 'Security', 'CCTV Surveillance', 'Swimming Pool', 'Gymnasium', 'Garden',
            'Clubhouse', "Children's Play Area", 'Fire Safety', '24x7 Water Supply', 'Solar Panels', 'Rainwater Harvesting',
            'Modular Kitchen', 'Air Conditioning', 'Gas Pipeline', 'Visitor Parking',
        ];
        foreach ($amenities as $i => $name) {
            Amenity::firstOrCreate(['slug' => Str::slug($name)], ['name' => $name, 'sort_order' => $i]);
        }

        foreach (Setting::DEFINITIONS as $key => $public) {
            Setting::firstOrCreate(['key' => $key], ['value' => $key === 'listing_validity_days' ? '90' : null, 'is_public' => $public]);
        }
    }
}
