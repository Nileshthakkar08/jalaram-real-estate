<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->restrictOnDelete();
            $table->string('reference_code', 20)->nullable()->unique();
            $table->string('title', 160);
            $table->string('slug', 200)->unique();
            $table->text('description');
            $table->enum('listing_purpose', ['sale', 'rent']);
            $table->enum('property_type', ['apartment', 'independent_house', 'villa', 'plot']);
            $table->foreignId('locality_id')->constrained()->restrictOnDelete();

            // Public, approximate location vs. private exact address.
            $table->string('public_address', 200);
            $table->string('private_address', 300)->nullable();
            $table->string('pincode', 6)->nullable();

            $table->decimal('price', 14, 2);
            $table->decimal('security_deposit', 14, 2)->nullable();
            $table->decimal('maintenance_charges', 12, 2)->nullable();
            $table->boolean('price_negotiable')->default(false);

            $table->unsignedInteger('area_sqft');
            $table->unsignedTinyInteger('bedrooms')->nullable();
            $table->unsignedTinyInteger('bathrooms')->nullable();
            $table->unsignedTinyInteger('balconies')->nullable();
            $table->smallInteger('floor_number')->nullable();
            $table->unsignedSmallInteger('total_floors')->nullable();
            $table->enum('furnishing', ['unfurnished', 'semi_furnished', 'fully_furnished'])->nullable();
            $table->string('facing', 20)->nullable();
            $table->unsignedTinyInteger('property_age_years')->nullable();
            $table->date('available_from')->nullable();

            // Private coordination contact (never exposed publicly).
            $table->string('owner_contact_name', 120)->nullable();
            $table->string('owner_contact_phone', 20)->nullable();
            $table->string('owner_contact_email', 160)->nullable();

            $table->enum('status', ['draft', 'pending', 'published', 'rejected', 'unavailable', 'expired', 'closed', 'suspended'])
                ->default('draft');
            $table->text('rejection_reason')->nullable();
            $table->text('moderation_note')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'listing_purpose', 'locality_id']);
            $table->index('price');
            $table->index('bedrooms');
        });

        Schema::create('property_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->string('disk', 30);
            $table->string('path', 300);
            $table->string('mime_type', 50);
            $table->unsignedInteger('size_bytes');
            $table->unsignedSmallInteger('width')->nullable();
            $table->unsignedSmallInteger('height')->nullable();
            $table->unsignedTinyInteger('sort_order')->default(0);
            $table->string('alt_text', 200)->nullable();
            $table->timestamps();

            $table->index(['property_id', 'sort_order']);
        });

        Schema::create('amenity_property', function (Blueprint $table) {
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->foreignId('amenity_id')->constrained()->restrictOnDelete();
            $table->primary(['property_id', 'amenity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('amenity_property');
        Schema::dropIfExists('property_images');
        Schema::dropIfExists('properties');
    }
};
