<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Device extends Model
{
    /** A device counts as online if it was heard from within this many seconds. */
    public const ONLINE_WINDOW_SECONDS = 45;

    protected $fillable = [
        'uid', 'name', 'ip', 'stream_port', 'stream_path',
        'armed', 'capture_requested', 'last_seen_at',
    ];

    protected $casts = [
        'armed'             => 'boolean',
        'capture_requested' => 'boolean',
        'stream_port'       => 'integer',
        'last_seen_at'      => 'datetime',
    ];

    protected $appends = ['online', 'stream_url'];

    public function captures(): HasMany
    {
        return $this->hasMany(Capture::class);
    }

    public function getOnlineAttribute(): bool
    {
        return $this->last_seen_at !== null
            && $this->last_seen_at->gt(now()->subSeconds(self::ONLINE_WINDOW_SECONDS));
    }

    /** The Pi serves its MJPEG live stream on its own LAN IP. */
    public function getStreamUrlAttribute(): ?string
    {
        return $this->ip ? "http://{$this->ip}:{$this->stream_port}{$this->stream_path}" : null;
    }

    /** The project has one camera; this returns it, creating it on first use. */
    public static function primary(): self
    {
        return static::firstOrCreate(
            ['uid' => config('surveillance.default_device_uid')],
            ['name' => 'Pi Camera', 'armed' => true],
        );
    }
}
