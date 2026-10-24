<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->string('reference_code', 20)->nullable()->unique();
            $table->string('name', 120);
            $table->string('phone', 20);
            $table->string('phone_normalized', 15)->index();
            $table->string('email', 160)->nullable();
            $table->foreignId('property_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('interest', ['buy', 'rent', 'sell', 'general'])->default('general');
            $table->enum('source', ['website', 'phone', 'whatsapp', 'walk_in', 'referral', 'social', 'other'])->default('website');
            $table->string('source_page', 255)->nullable();
            $table->string('utm_source', 100)->nullable();
            $table->string('utm_medium', 100)->nullable();
            $table->string('utm_campaign', 100)->nullable();
            $table->decimal('budget_min', 14, 2)->nullable();
            $table->decimal('budget_max', 14, 2)->nullable();
            $table->foreignId('preferred_locality_id')->nullable()->constrained('localities')->nullOnDelete();
            $table->unsignedTinyInteger('preferred_bhk')->nullable();
            $table->text('message')->nullable();
            $table->text('requirements')->nullable();
            $table->date('preferred_visit_date')->nullable();
            $table->string('preferred_visit_slot', 20)->nullable();
            $table->enum('status', ['new', 'assigned', 'contacted', 'qualified', 'site_visit', 'negotiation', 'won', 'lost', 'cancelled'])
                ->default('new')->index();
            $table->text('closed_reason')->nullable();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('next_follow_up_at')->nullable()->index();
            $table->timestamp('last_contacted_at')->nullable();
            $table->unsignedSmallInteger('contact_attempts')->default(0);
            $table->boolean('consent_contact')->default(false);
            $table->boolean('consent_marketing')->default(false);
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['assigned_to', 'status']);
            $table->index('created_at');
        });

        Schema::create('lead_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 40);
            $table->string('outcome', 40)->nullable();
            $table->text('body')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['lead_id', 'created_at']);
        });

        Schema::create('follow_ups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('due_at');
            $table->enum('channel', ['call', 'whatsapp', 'email', 'meeting', 'other'])->default('call');
            $table->text('notes')->nullable();
            $table->enum('status', ['pending', 'done', 'cancelled'])->default('pending');
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('outcome')->nullable();
            $table->timestamps();

            $table->index(['status', 'due_at']);
            $table->index(['assigned_to', 'status']);
        });

        Schema::create('site_visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $table->foreignId('property_id')->constrained()->restrictOnDelete();
            $table->enum('status', ['requested', 'scheduled', 'completed', 'cancelled', 'no_show'])->default('requested');
            $table->date('requested_date')->nullable();
            $table->string('requested_slot', 20)->nullable();
            $table->dateTime('scheduled_at')->nullable()->index();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('owner_confirmed')->default(false);
            $table->text('notes')->nullable();
            $table->text('customer_feedback')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'scheduled_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_visits');
        Schema::dropIfExists('follow_ups');
        Schema::dropIfExists('lead_activities');
        Schema::dropIfExists('leads');
    }
};
