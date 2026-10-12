<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Capture extends Model
{
    protected $fillable = ['device_id', 'path', 'size_bytes', 'trigger', 'burst_index', 'captured_at'];

    protected $casts = [
        'captured_at' => 'datetime',
        'size_bytes'  => 'integer',
        'burst_index' => 'integer',
    ];

    protected $appends = ['url'];

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }

    public function getUrlAttribute(): string
    {
        return Storage::disk('public')->url($this->path);
    }
}
