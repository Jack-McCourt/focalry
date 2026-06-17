<?php

use App\Http\Controllers\Gallery\CollectionController;
use App\Http\Controllers\Gallery\FavouriteController;
use App\Http\Controllers\Gallery\FavouriteListDownloadController;
use App\Http\Controllers\Gallery\GalleryController;
use App\Http\Controllers\Gallery\GalleryDownloadController;
use App\Http\Controllers\Gallery\SetController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Settings\StudioSettingsController;
use App\Http\Controllers\Stripe\ConnectController;
use App\Http\Controllers\Stripe\PublicInvoiceController;
use App\Http\Controllers\StudioManager\ContactController;
use App\Http\Controllers\StudioManager\InvoiceController;
use App\Http\Controllers\StudioManager\InvoiceSettingsController;
use App\Http\Controllers\StudioManager\ProjectController;
use App\Http\Controllers\StudioManager\ProjectFieldController;
use App\Http\Controllers\StudioManager\ProjectNoteController;
use App\Http\Controllers\StudioManager\ProjectSettingsController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', function () {
        return Inertia::render('Dashboard');
    })->name('dashboard');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Studio (business) settings — address + default currency
    Route::patch('/settings/studio', [StudioSettingsController::class, 'update'])->name('studio.update');
    Route::post('/settings/studio/logo', [StudioSettingsController::class, 'uploadLogo'])->name('studio.logo.upload');
    Route::delete('/settings/studio/logo', [StudioSettingsController::class, 'deleteLogo'])->name('studio.logo.delete');

    // Stripe Connect onboarding (studio accepts online payments)
    Route::post('/settings/stripe/connect', [ConnectController::class, 'onboard'])->name('stripe.connect');
    Route::get('/settings/stripe/return', [ConnectController::class, 'return'])->name('stripe.connect.return');
    // Embedded onboarding (Connect.js components)
    Route::post('/settings/stripe/account-session', [ConnectController::class, 'accountSession'])->name('stripe.connect.session');
    Route::post('/settings/stripe/refresh-status', [ConnectController::class, 'refreshStatus'])->name('stripe.connect.refresh');

    // Collections (Client Galleries)
    Route::resource('collections', CollectionController::class)->except(['edit']);

    // Studio Manager — Contacts (CRM)
    Route::resource('contacts', ContactController::class)->except(['create', 'edit']);

    // Studio Manager — Projects
    // Settings route before the resource so it isn't matched as projects/{project}.
    Route::get('projects/settings', [ProjectSettingsController::class, 'edit'])->name('projects.settings');
    Route::resource('projects', ProjectController::class)->only(['index', 'show', 'store', 'update', 'destroy']);
    Route::post('projects/{project}/move', [ProjectController::class, 'move'])->name('projects.move');
    Route::post('projects/{project}/notes', [ProjectNoteController::class, 'store'])->name('projects.notes.store');
    Route::patch('project-notes/{note}', [ProjectNoteController::class, 'update'])->name('project-notes.update');
    Route::delete('project-notes/{note}', [ProjectNoteController::class, 'destroy'])->name('project-notes.destroy');

    // Project custom field definitions
    Route::post('project-fields', [ProjectFieldController::class, 'store'])->name('project-fields.store');
    Route::post('project-fields/reorder', [ProjectFieldController::class, 'reorder'])->name('project-fields.reorder');
    Route::patch('project-fields/{field}', [ProjectFieldController::class, 'update'])->name('project-fields.update');
    Route::delete('project-fields/{field}', [ProjectFieldController::class, 'destroy'])->name('project-fields.destroy');

    // Project statuses (kanban columns) + types — customisable, colour-coded
    Route::post('project-statuses', [ProjectSettingsController::class, 'storeStatus'])->name('project-statuses.store');
    Route::post('project-statuses/reorder', [ProjectSettingsController::class, 'reorderStatuses'])->name('project-statuses.reorder');
    Route::patch('project-statuses/{status}', [ProjectSettingsController::class, 'updateStatus'])->name('project-statuses.update');
    Route::delete('project-statuses/{status}', [ProjectSettingsController::class, 'destroyStatus'])->name('project-statuses.destroy');
    Route::post('project-types', [ProjectSettingsController::class, 'storeType'])->name('project-types.store');
    Route::post('project-types/reorder', [ProjectSettingsController::class, 'reorderTypes'])->name('project-types.reorder');
    Route::patch('project-types/{type}', [ProjectSettingsController::class, 'updateType'])->name('project-types.update');
    Route::delete('project-types/{type}', [ProjectSettingsController::class, 'destroyType'])->name('project-types.destroy');

    // Studio Manager — Invoices
    // Settings routes registered before the resource so they don't match {invoice}.
    Route::get('invoices/settings', [InvoiceSettingsController::class, 'edit'])->name('invoices.settings.edit');
    Route::patch('invoices/settings', [InvoiceSettingsController::class, 'update'])->name('invoices.settings.update');
    Route::resource('invoices', InvoiceController::class);
    Route::post('invoices/{invoice}/sent', [InvoiceController::class, 'markSent'])->name('invoices.sent');
    Route::post('invoices/{invoice}/void', [InvoiceController::class, 'void'])->name('invoices.void');
    Route::post('invoices/{invoice}/payments', [InvoiceController::class, 'recordPayment'])->name('invoices.payments.store');

    // Sets nested under collections
    Route::post('collections/{collection}/sets', [SetController::class, 'store'])
        ->name('sets.store');
    Route::patch('collections/{collection}/sets/{set}', [SetController::class, 'update'])
        ->name('sets.update');
    Route::delete('collections/{collection}/sets/{set}', [SetController::class, 'destroy'])
        ->name('sets.destroy');
    Route::post('collections/{collection}/sets/reorder', [SetController::class, 'reorder'])
        ->name('sets.reorder');

    // Download a client's favourite list as a ZIP of originals
    Route::get('collections/{collection}/favourite-lists/{list}/download', [FavouriteListDownloadController::class, 'download'])
        ->name('favourite-lists.download');
    // Export a client's favourite list as a CSV of filenames + notes
    Route::get('collections/{collection}/favourite-lists/{list}/export-csv', [FavouriteListDownloadController::class, 'exportCsv'])
        ->name('favourite-lists.export-csv');
});

// Public invoice payment (no auth — resolved by unguessable public_id)
Route::get('/i/{publicId}', [PublicInvoiceController::class, 'show'])->name('invoices.public.show');
Route::get('/i/{publicId}/pdf', [PublicInvoiceController::class, 'pdf'])->name('invoices.public.pdf');
Route::post('/i/{publicId}/checkout', [PublicInvoiceController::class, 'checkout'])->name('invoices.public.checkout');

// Public gallery (no full auth — password/email-gate handled inside)
Route::get('/g/{slug}', [GalleryController::class, 'show'])->name('gallery.show');
Route::post('/g/{slug}', [GalleryController::class, 'show']);

// Gallery visitor favourite routes (session-based, no studio auth)
Route::post('/g/{slug}/visitor', [FavouriteController::class, 'updateVisitor'])
    ->name('gallery.visitor.update');
Route::get('/g/{slug}/lists', [FavouriteController::class, 'lists'])
    ->name('gallery.lists');
Route::post('/g/{slug}/lists', [FavouriteController::class, 'createList'])
    ->name('gallery.lists.create');
Route::post('/g/{slug}/favourites/{photoId}', [FavouriteController::class, 'toggle'])
    ->name('gallery.favourite.toggle');
Route::post('/g/{slug}/favourites/{photoId}/note', [FavouriteController::class, 'note'])
    ->name('gallery.favourite.note');

// Client-facing controlled downloads (respect download settings + PIN gate)
Route::post('/g/{slug}/download/verify-pin', [GalleryDownloadController::class, 'verifyPin'])
    ->name('gallery.download.verify-pin');
Route::get('/g/{slug}/download', [GalleryDownloadController::class, 'all'])
    ->name('gallery.download.all');
Route::get('/g/{slug}/download/{photoId}', [GalleryDownloadController::class, 'single'])
    ->whereNumber('photoId')
    ->name('gallery.download.single');

require __DIR__.'/auth.php';
