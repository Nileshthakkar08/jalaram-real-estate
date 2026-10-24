<?php

namespace App\Console\Commands;

use App\Services\PropertyWorkflow;
use Illuminate\Console\Command;

class ExpireListings extends Command
{
    protected $signature = 'listings:expire';

    protected $description = 'Mark published listings past their expiry date as expired';

    public function handle(PropertyWorkflow $workflow): int
    {
        $count = $workflow->expireDue();
        $this->info("Expired {$count} listing(s).");

        return self::SUCCESS;
    }
}
