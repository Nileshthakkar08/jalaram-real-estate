<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class PropertyImage extends Model
{
    protected $fillable = ['property_id', 'disk', 'path', 'mime_type', 'size_bytes', 'width', 'height', 'sort_order', 'alt_text'];

    protected $casts = ['size_bytes' => 'integer', 'width' => 'integer', 'height' => 'integer', 'sort_order' => 'integer'];

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    public function url(): string
    {
        // Seeded demo images may reference an absolute URL instead of a stored file.
        if (str_starts_with($this->path, 'http://') || str_starts_with($this->path, 'https://')) {
            return $this->path;
        }

        return Storage::disk($this->disk)->url($this->path);
    }
}
