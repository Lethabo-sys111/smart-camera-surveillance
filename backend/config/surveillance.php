<?php

return [
    // Shared secret the Raspberry Pi sends in the X-Device-Key header.
    'device_key' => env('DEVICE_KEY'),

    // Used when the Pi doesn't send an X-Device-Id header.
    'default_device_uid' => env('DEFAULT_DEVICE_UID', 'cam-01'),

    // Uploads larger than this (in KB) are rejected. 1280x720 JPEGs are ~100–300 KB.
    'max_upload_kb' => (int) env('MAX_UPLOAD_KB', 2048),
];
