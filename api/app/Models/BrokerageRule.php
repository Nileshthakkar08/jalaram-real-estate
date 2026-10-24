<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class BrokerageRule extends Model
{
    use HasFactory, SoftDeletes;

    public const METHODS = ['fixed', 'percentage', 'negotiated'];

    public const BASES = ['monthly_rent', 'annual_rent', 'final_sale_price', 'asking_price'];

    public const PAYERS = ['owner', 'tenant', 'buyer', 'seller', 'split'];

    /** Which parties can be charged for each transaction type. */
    public const PARTIES = [
        'rent' => ['owner', 'tenant'],
        'sale' => ['seller', 'buyer'],
    ];

    protected $fillable = [
        'name', 'transaction_type', 'method', 'fixed_amount', 'percentage', 'percentage_basis', 'min_amount',
        'max_amount', 'payer', 'split_shares', 'property_type', 'locality_id', 'effective_from', 'effective_to',
        'is_active', 'priority', 'notes', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'fixed_amount' => 'decimal:2',
        'percentage' => 'decimal:4',
        'min_amount' => 'decimal:2',
        'max_amount' => 'decimal:2',
        'split_shares' => 'array',
        'effective_from' => 'date',
        'effective_to' => 'date',
        'is_active' => 'boolean',
        'priority' => 'integer',
    ];

    public function locality(): BelongsTo
    {
        return $this->belongsTo(Locality::class);
    }

    /** Party => share percentage this rule charges. */
    public function shares(): array
    {
        if ($this->payer === 'split') {
            return array_map('floatval', $this->split_shares ?? []);
        }

        // "owner" on a sale means the seller (and vice versa) — normalise to the transaction's party names.
        $party = match (true) {
            $this->transaction_type === 'sale' && $this->payer === 'owner' => 'seller',
            $this->transaction_type === 'rent' && $this->payer === 'seller' => 'owner',
            $this->transaction_type === 'rent' && $this->payer === 'buyer' => 'tenant',
            $this->transaction_type === 'sale' && $this->payer === 'tenant' => 'buyer',
            default => $this->payer,
        };

        return [$party => 100];
    }
}
