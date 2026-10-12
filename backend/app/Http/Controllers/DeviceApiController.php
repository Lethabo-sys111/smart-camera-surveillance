<?php

namespace App\Http\Controllers;

use App\Models\Capture;
use App\Models\Device;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Endpoints called BY the Raspberry Pi camera (protected by EnsureDeviceKey).
 * Every response carries the camera's current commands (armed / capture_now),
 * so the Pi only has to talk to the server — the server never calls the Pi.
 */
class DeviceApiController extends Controller
{
    /**
     * POST /api/device/upload
     * Accepts a multipart form with an "image" field, or a raw JPEG body
     * (Content-Type: image/jpeg).
     *
     * Optional headers: X-Device-Id, X-Trigger (motion|manual), X-Burst-Index (1..n)
     */
    public function upload(Request $request): JsonResponse
    {
        $device = $this->touchDevice($request);
        $maxKb = config('surveillance.max_upload_kb');

        if ($request->hasFile('image')) {
            $request->validate([
                'image' => ['required', 'file', 'mimes:jpg,jpeg', 'max:'.$maxKb],
            ]);
            $bytes = $request->file('image')->get();
        } else {
            $bytes = $request->getContent();
        }

        if ($bytes === '' || $bytes === false || $bytes === null) {
            return response()->json(['message' => 'No image data received.'], 422);
        }
        if (strlen($bytes) > $maxKb * 1024) {
            return response()->json(['message' => 'Image too large.'], 413);
        }
        // Every JPEG file starts with the bytes FF D8 FF.
        if (substr($bytes, 0, 3) !== "\xFF\xD8\xFF") {
            return response()->json(['message' => 'Data is not a JPEG image.'], 422);
        }

        $trigger = $request->header('X-Trigger') === 'manual' ? 'manual' : 'motion';

        $now = now();
        $path = sprintf('captures/%s/%s_%s.jpg', $now->format('Y-m-d'), $now->format('His'), Str::random(6));
        Storage::disk('public')->put($path, $bytes);

        $capture = Capture::create([
            'device_id'   => $device->id,
            'path'        => $path,
            'size_bytes'  => strlen($bytes),
            'trigger'     => $trigger,
            'burst_index' => max(1, min(255, (int) $request->header('X-Burst-Index', 1))),
            'captured_at' => $now,
        ]);

        // A manual photo answers the "Take photo" request, so clear it.
        if ($trigger === 'manual' && $device->capture_requested) {
            $device->update(['capture_requested' => false]);
        }

        return response()->json(['id' => $capture->id, ...$this->commands($device)], 201);
    }

    /**
     * POST /api/device/heartbeat   JSON: {"ip": "...", "stream_port": 8000, "stream_path": "/stream.mjpg"}
     * The Pi calls this every few seconds so the web app knows it is online,
     * knows where the live stream is, and the Pi learns its commands.
     */
    public function heartbeat(Request $request): JsonResponse
    {
        $device = $this->touchDevice($request);

        return response()->json($this->commands($device));
    }

    /** What the camera should do right now. */
    private function commands(Device $device): array
    {
        return [
            'armed'       => $device->armed,
            'capture_now' => $device->capture_requested,
        ];
    }

    private function touchDevice(Request $request): Device
    {
        $uid = $request->header('X-Device-Id') ?: config('surveillance.default_device_uid');

        $device = Device::firstOrCreate(['uid' => $uid], ['name' => 'Pi Camera', 'armed' => true]);

        // The Pi reports its own LAN IP; fall back to the address it connected from.
        $ip = $request->input('ip') ?: $request->header('X-Device-IP') ?: $request->ip();
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            $device->ip = $ip;
        }

        $port = (int) $request->input('stream_port');
        if ($port >= 1 && $port <= 65535) {
            $device->stream_port = $port;
        }

        $streamPath = (string) $request->input('stream_path');
        if (preg_match('#^/[A-Za-z0-9._/-]{0,100}$#', $streamPath)) {
            $device->stream_path = $streamPath;
        }

        $device->last_seen_at = now();
        $device->save();

        return $device;
    }
}
