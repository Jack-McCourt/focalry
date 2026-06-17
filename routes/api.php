<?php

use App\Http\Controllers\Gallery\PhotoController;
use App\Http\Controllers\Gallery\PresignedUploadController;
use App\Http\Controllers\Stripe\WebhookController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Stripe webhooks — no auth, Stripe signature verified in controller
Route::post('stripe/webhook', [WebhookController::class, 'handleWebhook'])
    ->name('cashier.webhook');

// Authenticated studio API routes
Route::middleware(['auth:sanctum', 'verified'])->group(function () {
    Route::post('uploads/presign', [PresignedUploadController::class, 'store'])
        ->name('uploads.presign');

    Route::post('photos', [PhotoController::class, 'store'])
        ->name('photos.store');
    Route::post('photos/assign-set', [PhotoController::class, 'assignSet'])
        ->name('photos.assign-set');
    Route::patch('photos/{photo}', [PhotoController::class, 'update'])
        ->name('photos.update');
    Route::post('photos/{photo}/cover', [PhotoController::class, 'setCover'])
        ->name('photos.cover');
    Route::delete('photos/{photo}', [PhotoController::class, 'destroy'])
        ->name('photos.destroy');
});
