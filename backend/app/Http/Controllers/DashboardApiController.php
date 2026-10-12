<?php

namespace App\Http\Controllers;

use App\Models\Capture;
use App\Models\Device;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Endpoints called by the React web app.
 */
class DashboardApiController extends Controller
{
    /** GET /api/camera — camera status for the header bar. */
    public function camera(): JsonResponse
    {
        return response()->json($this->cameraPayload(Device::primary()));
    }

    /** PATCH /api/camera — arm/disarm or rename the camera. */
    public function updateCamera(Request $request): JsonResponse
    {
        $data = $request->validate([
            'armed' => ['sometimes', 'boolean'],
            'name'  => ['sometimes', 'string', 'max:60'],
        ]);

        $device = Device::primary();
        $device->update($data);

        return response()->json($this->cameraPayload($device->fresh()));
    }

    /**
     * POST /api/camera/capture — "Take photo now".
     * Sets a flag; the Pi sees it on its next heartbeat (a few seconds) and uploads a photo.
     */
    public function requestCapture(): JsonResponse
    {
        $device = Device::primary();
        $device->update(['capture_requested' => true]);

        return response()->json($this->cameraPayload($device->fresh()), 202);
    }

    private function cameraPayload(Device $device): array
    {
        return [
            ...$device->toArray(),
            'captures_today' => $device->captures()->whereDate('captured_at', today())->count(),
            'captures_total' => $device->captures()->count(),
        ];
    }

    /** GET /api/captures?page=1&per_page=24&date=2026-10-12 — newest first. */
    public function captures(Request $request): JsonResponse
    {
        $request->validate([
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'date'     => ['sometimes', 'date_format:Y-m-d'],
        ]);

        $query = Capture::query()->latest('captured_at')->latest('id');

        if ($request->filled('date')) {
            $query->whereDate('captured_at', $request->input('date'));
        }

        return response()->json($query->paginate($request->integer('per_page', 24)));
    }

    /** DELETE /api/captures/{capture} */
    public function destroy(Capture $capture): JsonResponse
    {
        Storage::disk('public')->delete($capture->path);
        $capture->delete();

        return response()->json(null, 204);
    }
}
