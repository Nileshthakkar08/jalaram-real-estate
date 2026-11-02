<?php

namespace App\Console\Commands;

use App\Services\PropertyVideoService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PruneVideoUploads extends Command
{
    protected $signature = 'videos:prune-uploads';

    protected $description = 'Delete pieces of video uploads that were never finished';

    public function handle(): int
    {
        $local = Storage::disk('local');
        $cutoff = now()->subHours(PropertyVideoService::STALE_AFTER_HOURS)->getTimestamp();
        $count = 0;

        foreach ($local->directories('video-uploads') as $propertyDir) {
            foreach ($local->directories($propertyDir) as $uploadDir) {
                $files = $local->files($uploadDir);
                $latest = $files ? max(array_map(fn ($f) => $local->lastModified($f), $files)) : 0;
                if ($latest < $cutoff) {
                    $local->deleteDirectory($uploadDir);
                    $count++;
                }
            }
            if (! $local->directories($propertyDir)) {
                $local->deleteDirectory($propertyDir);
            }
        }

        $this->info("Removed {$count} unfinished video upload(s).");

        return self::SUCCESS;
    }
}
