<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('brokerage_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->enum('transaction_type', ['sale', 'rent']);
            $table->enum('method', ['fixed', 'percentage', 'negotiated']);
            $table->decimal('fixed_amount', 14, 2)->nullable();
            $table->decimal('percentage', 7, 4)->nullable();
            $table->enum('percentage_basis', ['monthly_rent', 'annual_rent', 'final_sale_price', 'asking_price'])->nullable();
            $table->decimal('min_amount', 14, 2)->nullable();
            $table->decimal('max_amount', 14, 2)->nullable();
            $table->enum('payer', ['owner', 'tenant', 'buyer', 'seller', 'split']);
            $table->json('split_shares')->nullable();
            $table->enum('property_type', ['apartment', 'independent_house', 'villa', 'plot'])->nullable();
            $table->foreignId('locality_id')->nullable()->constrained()->nullOnDelete();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->smallInteger('priority')->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['transaction_type', 'is_active', 'effective_from']);
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->id();
            $table->string('reference_code', 20)->nullable()->unique();
            $table->foreignId('property_id')->constrained()->restrictOnDelete();
            $table->foreignId('lead_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('owner_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('transaction_type', ['sale', 'rent']);
            $table->enum('status', ['negotiation', 'agreement_pending', 'closed_won', 'closed_lost', 'cancelled'])
                ->default('negotiation')->index();
            $table->string('customer_name', 120);
            $table->string('customer_phone', 20)->nullable();
            $table->decimal('asking_price', 14, 2);
            $table->decimal('final_price', 14, 2)->nullable();
            $table->decimal('security_deposit', 14, 2)->nullable();
            $table->date('lease_start_date')->nullable();
            $table->unsignedSmallInteger('lease_term_months')->nullable();
            $table->foreignId('brokerage_rule_id')->nullable()->constrained()->nullOnDelete();
            $table->json('brokerage_basis')->nullable();
            $table->decimal('estimated_brokerage', 14, 2)->nullable();
            $table->text('negotiation_notes')->nullable();
            $table->text('closed_reason')->nullable();
            $table->date('agreement_date')->nullable();
            $table->timestamp('closed_at')->nullable()->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['assigned_to', 'status']);
        });

        Schema::create('brokerage_agreements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deal_id')->constrained()->cascadeOnDelete();
            $table->enum('party', ['owner', 'tenant', 'buyer', 'seller']);
            $table->string('party_name', 120)->nullable();
            $table->string('party_phone', 20)->nullable();
            $table->decimal('estimated_amount', 14, 2)->nullable();
            $table->decimal('agreed_amount', 14, 2)->nullable();
            $table->boolean('is_override')->default(false);
            $table->text('override_reason')->nullable();
            $table->date('due_date')->nullable();
            $table->string('invoice_number', 60)->nullable();
            $table->date('invoice_date')->nullable();
            $table->decimal('invoiced_amount', 14, 2)->default(0);
            $table->decimal('amount_received', 14, 2)->default(0);
            $table->decimal('amount_refunded', 14, 2)->default(0);
            $table->decimal('amount_waived', 14, 2)->default(0);
            $table->decimal('outstanding_amount', 14, 2)->default(0);
            $table->enum('status', ['estimated', 'agreed', 'due', 'partially_paid', 'paid', 'cancelled', 'waived', 'refunded'])
                ->default('estimated')->index();
            $table->timestamp('agreed_at')->nullable();
            $table->foreignId('agreed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('cancelled_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['deal_id', 'party']);
        });

        Schema::create('brokerage_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brokerage_agreement_id')->constrained()->restrictOnDelete();
            $table->foreignId('deal_id')->constrained()->restrictOnDelete();
            $table->enum('type', ['payment', 'refund', 'waiver']);
            $table->decimal('amount', 14, 2);
            $table->date('payment_date')->index();
            $table->enum('method', ['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other'])->nullable();
            $table->string('reference_number', 80)->nullable();
            $table->string('receipt_number', 80)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('void_reason')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deal_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['agreement', 'token_receipt', 'invoice', 'receipt', 'id_proof', 'other']);
            $table->string('title', 160);
            $table->string('reference_number', 80)->nullable();
            $table->string('disk', 30)->nullable();
            $table->string('path', 300)->nullable();
            $table->string('mime_type', 60)->nullable();
            $table->unsignedInteger('size_bytes')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('owner_coordination_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lead_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('deal_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['availability', 'confirmed_price', 'viewing_availability', 'negotiation', 'owner_response', 'agreed_terms', 'general']);
            $table->text('body');
            $table->timestamps();

            $table->index(['property_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('owner_coordination_notes');
        Schema::dropIfExists('deal_documents');
        Schema::dropIfExists('brokerage_payments');
        Schema::dropIfExists('brokerage_agreements');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('brokerage_rules');
    }
};
