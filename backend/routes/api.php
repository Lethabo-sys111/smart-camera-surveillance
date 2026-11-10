<?php

use App\Http\Controllers\DashboardApiController;
use App\Http\Controllers\DeviceApiController;
use App\Models\Device;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// --- Called by the Raspberry Pi (needs X-Device-Key header) ---
Route::middleware('device.key')->prefix('device')->group(function () {
    Route::post('/upload', [DeviceApiController::class, 'upload']);
    Route::post('/heartbeat', [DeviceApiController::class, 'heartbeat']);

    // NFC card tap: flip between armed and disarmed
    Route::post('/toggle', function (Request $request) {
        $device = Device::where('uid', $request->header('X-Device-Id', 'cam-01'))->firstOrFail();
        $device->forceFill(['armed' => ! $device->armed])->save();
        return response()->json(['armed' => (bool) $device->armed]);
    });
});

// --- Called by the web app ---
Route::get('/camera', [DashboardApiController::class, 'camera']);
Route::patch('/camera', [DashboardApiController::class, 'updateCamera']);
Route::post('/camera/capture', [DashboardApiController::class, 'requestCapture']);
Route::get('/captures', [DashboardApiController::class, 'captures']);
Route::delete('/captures/{capture}', [DashboardApiController::class, 'destroy']);
