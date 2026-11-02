<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** One walkthrough video per listing, stored like the photos. */
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->string('video_disk', 40)->nullable()->after('is_featured');
            $table->string('video_path')->nullable()->after('video_disk');
            $table->string('video_mime', 40)->nullable()->after('video_path');
            $table->unsignedBigInteger('video_size_bytes')->nullable()->after('video_mime');
        });
    }

    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->dropColumn(['video_disk', 'video_path', 'video_mime', 'video_size_bytes']);
        });
    }
};
