<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Only the Pi camera may call the /api/device/* endpoints.
 * It proves who it is by sending the shared DEVICE_KEY in a header.
 */
class EnsureDeviceKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = config('surveillance.device_key');

        if (! $expected) {
            return response()->json(['message' => 'DEVICE_KEY is not set on the server.'], 500);
        }

        if (! hash_equals($expected, (string) $request->header('X-Device-Key'))) {
            return response()->json(['message' => 'Invalid device key.'], 401);
        }

        return $next($request);
    }
}
