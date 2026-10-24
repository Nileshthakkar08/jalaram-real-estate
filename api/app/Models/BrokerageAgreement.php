<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class BrokerageAgreement extends Model
{
    use SoftDeletes;

    public const STATUSES = ['estimated', 'agreed', 'due', 'partially_paid', 'paid', 'cancelled', 'waived', 'refunded'];

    public const PARTIES = ['owner', 'tenant', 'buyer', 'seller'];

    protected $fillable = [
        'deal_id', 'party', 'party_name', 'party_phone', 'estimated_amount', 'agreed_amount', 'is_override',
        'override_reason', 'due_date', 'invoice_number', 'invoice_date', 'invoiced_amount', 'amount_received',
        'amount_refunded', 'amount_waived', 'outstanding_amount', 'status', 'agreed_at', 'agreed_by',
        'cancelled_reason', 'notes',
    ];

    protected $casts = [
        'estimated_amount' => 'decimal:2',
        'agreed_amount' => 'decimal:2',
        'invoiced_amount' => 'decimal:2',
        'amount_received' => 'decimal:2',
        'amount_refunded' => 'decimal:2',
        'amount_waived' => 'decimal:2',
        'outstanding_amount' => 'decimal:2',
        'is_override' => 'boolean',
        'due_date' => 'date',
        'invoice_date' => 'date',
        'agreed_at' => 'datetime',
    ];

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class)->withTrashed();
    }

    public function payments(): HasMany
    {
        return $this->hasMany(BrokeragePayment::class)->orderByDesc('payment_date')->orderByDesc('id');
    }

    public function agreedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agreed_by')->withTrashed();
    }
}
