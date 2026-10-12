<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('devices', function (Blueprint $table) {
            $table->id();
            $table->string('uid')->unique();          // e.g. "cam-01", sent by the Pi
            $table->string('name');
            $table->string('ip')->nullable();         // LAN IP reported by the Pi
            $table->unsignedSmallInteger('stream_port')->default(8000);
            $table->string('stream_path')->default('/stream.mjpg');
            $table->boolean('armed')->default(true);
            $table->boolean('capture_requested')->default(false); // "Take photo" button in the web app
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
        });

        Schema::create('captures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('device_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->unsignedInteger('size_bytes')->default(0);
            $table->string('trigger')->default('motion'); // motion | manual
            $table->unsignedTinyInteger('burst_index')->default(1); // 1st, 2nd, 3rd shot of a burst
            $table->timestamp('captured_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('captures');
        Schema::dropIfExists('devices');
    }
};
