<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Minishlink\WebPush\VAPID;

class GenerateVapidKeys extends Command
{
    protected $signature = 'push:vapid';

    protected $description = 'Generate a VAPID key pair for browser push notifications (add the output to .env)';

    public function handle(): int
    {
        $keys = VAPID::createVapidKeys();
        $this->line('Add these lines to .env (keep the private key secret), then run php artisan config:cache:');
        $this->newLine();
        $this->line('VAPID_PUBLIC_KEY='.$keys['publicKey']);
        $this->line('VAPID_PRIVATE_KEY='.$keys['privateKey']);
        $this->line('VAPID_SUBJECT=mailto:your-email@example.com');
        $this->newLine();
        $this->warn('Generate keys only once. Changing them invalidates every existing subscription.');

        return self::SUCCESS;
    }
}
