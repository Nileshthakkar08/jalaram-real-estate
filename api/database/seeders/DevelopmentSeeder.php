<?php

namespace Database\Seeders;

use App\Models\Amenity;
use App\Models\BrokerageRule;
use App\Models\Lead;
use App\Models\Locality;
use App\Models\Property;
use App\Models\User;
use App\Services\BrokerageLedger;
use App\Services\DealWorkflow;
use App\Services\LeadService;
use App\Services\PropertyWorkflow;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Auth;
use RuntimeException;

/**
 * DEMO DATA FOR LOCAL DEVELOPMENT ONLY. Every listing is titled "[Demo]" and every person
 * is fictional. Refuses to run in production.
 */
class DevelopmentSeeder extends Seeder
{
    private const PASSWORD = 'Password123';

    private const DEMO_IMAGES = [
        'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1200',
        'https://images.pexels.com/photos/1571468/pexels-photo-1571468.jpeg?auto=compress&cs=tinysrgb&w=1200',
        'https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg?auto=compress&cs=tinysrgb&w=1200',
        'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=1200',
        'https://images.pexels.com/photos/2635038/pexels-photo-2635038.jpeg?auto=compress&cs=tinysrgb&w=1200',
        'https://images.pexels.com/photos/1918291/pexels-photo-1918291.jpeg?auto=compress&cs=tinysrgb&w=1200',
    ];

    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('DevelopmentSeeder must never run in production.');
        }
        if (User::query()->where('email', 'admin@jalaram.test')->exists()) {
            $this->command?->warn('Demo data already present — skipping.');

            return;
        }

        $admin = User::factory()->admin()->create(['name' => 'Demo Admin', 'email' => 'admin@jalaram.test', 'password' => self::PASSWORD]);
        $manager = User::factory()->teamMember(array_keys(User::PERMISSIONS))
            ->create(['name' => 'Demo Team Lead', 'email' => 'lead@jalaram.test', 'password' => self::PASSWORD]);
        $agent = User::factory()->teamMember()->create(['name' => 'Demo Team Member', 'email' => 'team@jalaram.test', 'password' => self::PASSWORD]);
        $owner = User::factory()->create(['name' => 'Demo Owner', 'email' => 'owner@jalaram.test', 'password' => self::PASSWORD]);
        $owner2 = User::factory()->create(['name' => 'Second Demo Owner', 'email' => 'owner2@jalaram.test', 'password' => self::PASSWORD]);

        Auth::setUser($admin);

        // Example rules only — real rates must be configured by an admin.
        BrokerageRule::create([
            'name' => '[Example] Residential rent — one month rent, split owner/tenant', 'transaction_type' => 'rent',
            'method' => 'percentage', 'percentage' => 100, 'percentage_basis' => 'monthly_rent', 'payer' => 'split',
            'split_shares' => ['owner' => 50, 'tenant' => 50], 'effective_from' => now()->subYear(), 'created_by' => $admin->id,
            'notes' => 'Example rule for development. Replace with the agreed policy.',
        ]);
        BrokerageRule::create([
            'name' => '[Example] Residential sale — 1% of final sale price, buyer', 'transaction_type' => 'sale',
            'method' => 'percentage', 'percentage' => 1, 'percentage_basis' => 'final_sale_price', 'payer' => 'buyer',
            'effective_from' => now()->subYear(), 'created_by' => $admin->id,
            'notes' => 'Example rule for development. Replace with the agreed policy.',
        ]);

        $workflow = app(PropertyWorkflow::class);
        $loc = fn (string $slug) => Locality::where('slug', $slug)->value('id');
        $listings = [
            [$owner, 'sale', 'apartment', 'bodakdev', '[Demo] 3 BHK Apartment near Judges Bungalow Road', 9500000, 1650, 3, 'semi_furnished', true],
            [$owner, 'rent', 'apartment', 'prahlad-nagar', '[Demo] 2 BHK Furnished Flat in Prahlad Nagar', 12000, 1100, 2, 'fully_furnished', true],
            [$owner, 'sale', 'villa', 'shela', '[Demo] 4 BHK Villa with Private Garden', 24500000, 3200, 4, 'unfurnished', false],
            [$owner2, 'rent', 'independent_house', 'satellite', '[Demo] 3 BHK Independent House in Satellite', 35000, 2100, 3, 'semi_furnished', false],
            [$owner2, 'sale', 'apartment', 'gota', '[Demo] 2 BHK Apartment close to SG Highway', 4800000, 1050, 2, 'unfurnished', false],
            [$owner2, 'rent', 'apartment', 'vastrapur', '[Demo] 1 BHK Apartment near Vastrapur Lake', 14000, 650, 1, 'semi_furnished', false],
        ];

        $properties = [];
        foreach ($listings as $i => [$o, $purpose, $type, $locality, $title, $price, $area, $bhk, $furnishing, $featured]) {
            $p = Property::create([
                'owner_id' => $o->id, 'title' => $title, 'listing_purpose' => $purpose, 'property_type' => $type,
                'locality_id' => $loc($locality), 'price' => $price, 'area_sqft' => $area, 'bedrooms' => $bhk,
                'bathrooms' => max(1, $bhk - 1), 'furnishing' => $furnishing, 'security_deposit' => $purpose === 'rent' ? $price * 2 : null,
                'public_address' => 'Demo address, '.Locality::find($loc($locality))->name.', Ahmedabad',
                'private_address' => 'Demo private address — not a real location', 'is_featured' => $featured,
                'description' => "This is a demonstration listing created for local development. It does not describe a real property.\n\nUse it to test search, enquiries, site visits and the brokerage workflow.",
                'status' => 'draft',
            ]);
            foreach (array_slice(self::DEMO_IMAGES, $i % 3, 3) as $order => $url) {
                $p->images()->create(['disk' => 'public', 'path' => $url, 'mime_type' => 'image/jpeg', 'size_bytes' => 0, 'sort_order' => $order, 'alt_text' => $title]);
            }
            $p->amenities()->sync(Amenity::inRandomOrder()->limit(5)->pluck('id'));
            $workflow->submit($p);
            if ($i < 5) {
                $workflow->approve($p);
            }
            $properties[] = $p->fresh();
        }

        // Leads arriving from the website.
        $leads = app(LeadService::class);
        [$l1] = $leads->intake(['name' => 'Demo Customer A', 'phone' => '9000000001', 'interest' => 'rent', 'property_id' => $properties[1]->id,
            'source' => 'website', 'message' => 'Is this flat available from next month?', 'consent_contact' => true]);
        [$l2] = $leads->intake(['name' => 'Demo Customer B', 'phone' => '9000000002', 'interest' => 'buy', 'property_id' => $properties[0]->id,
            'source' => 'website', 'consent_contact' => true], ['preferred_date' => now()->addDays(3)->toDateString(), 'preferred_slot' => 'evening']);
        $leads->intake(['name' => 'Demo Customer C', 'phone' => '9000000003', 'interest' => 'general', 'source' => 'website',
            'message' => 'Looking for a 3 BHK in Bodakdev under 1 Cr.', 'consent_contact' => true]);

        // Work one rental lead through to a closed deal with a partial brokerage payment.
        $leads->assign($l1, $agent, $manager);
        $leads->logActivity($l1, $agent, 'call', 'connected', 'Customer confirmed interest. Wants to move in next month.');
        $leads->assign($l2, $agent, $manager);

        $deals = app(DealWorkflow::class);
        $deal = $deals->create($l1, $properties[1], $agent, ['final_price' => 12000]);
        foreach ($deal->agreements as $agreement) {
            $deals->updateAgreement($agreement, $manager, ['agreed_amount' => '5000.00', 'due_date' => now()->addDays(7)->toDateString(), 'reason' => 'Agreed with both parties as estimated.']);
        }
        $deals->changeStatus($deal, 'agreement_pending', $agent);
        $deals->changeStatus($deal->fresh(), 'closed_won', $agent);
        $tenantAgreement = $deal->agreements()->where('party', 'tenant')->first();
        app(BrokerageLedger::class)->record($tenantAgreement, $manager, [
            'type' => 'payment', 'amount' => '3000', 'payment_date' => now()->toDateString(), 'method' => 'upi', 'reference_number' => 'DEMO-UPI-001',
        ]);

        Auth::forgetUser();

        $this->command?->info('Demo accounts (password '.self::PASSWORD.'): admin@jalaram.test, lead@jalaram.test, team@jalaram.test, owner@jalaram.test, owner2@jalaram.test');
    }
}
