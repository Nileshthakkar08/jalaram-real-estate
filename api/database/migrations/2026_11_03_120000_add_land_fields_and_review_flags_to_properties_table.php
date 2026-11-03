<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            // Land listings: kind of land, and the unit the owner entered the area in (area_sqft stays canonical).
            $table->string('land_type', 30)->nullable()->after('property_type');
            $table->string('area_unit', 10)->default('sqft')->after('area_sqft');
            // Why automatic review left the listing for a person to check (null = nothing flagged).
            $table->json('review_flags')->nullable()->after('moderation_note');
        });
    }

    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->dropColumn(['land_type', 'area_unit', 'review_flags']);
        });
    }
};
