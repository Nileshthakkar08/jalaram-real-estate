<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DealDocument extends Model
{
    public const TYPES = ['agreement', 'token_receipt', 'invoice', 'receipt', 'id_proof', 'other'];

    protected $fillable = ['deal_id', 'type', 'title', 'reference_number', 'disk', 'path', 'mime_type', 'size_bytes', 'uploaded_by'];

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by')->withTrashed();
    }
}
