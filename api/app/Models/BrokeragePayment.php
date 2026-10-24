<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BrokeragePayment extends Model
{
    public const TYPES = ['payment', 'refund', 'waiver'];

    public const METHODS = ['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other'];

    protected $fillable = [
        'brokerage_agreement_id', 'deal_id', 'type', 'amount', 'payment_date', 'method', 'reference_number',
        'receipt_number', 'notes', 'recorded_by', 'voided_at', 'voided_by', 'void_reason',
    ];

    protected $casts = ['amount' => 'decimal:2', 'payment_date' => 'date', 'voided_at' => 'datetime'];

    public function agreement(): BelongsTo
    {
        return $this->belongsTo(BrokerageAgreement::class, 'brokerage_agreement_id');
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by')->withTrashed();
    }

    public function scopeValid(Builder $query): Builder
    {
        return $query->whereNull('voided_at');
    }
}
