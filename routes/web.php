<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\MusicController;

// Inertia Single Page Application Views
Route::get('/', [MusicController::class, 'index'])->name('home');
Route::get('/favorites', [MusicController::class, 'favorites'])->name('favorites');
Route::get('/history', [MusicController::class, 'history'])->name('history');

// Internal API routes for YouTube Music
Route::get('/api/search', [MusicController::class, 'search'])->name('api.search');
Route::get('/api/lyrics', [MusicController::class, 'lyrics'])->name('api.lyrics');
Route::get('/api/related', [MusicController::class, 'related'])->name('api.related');
Route::get('/api/alternative', [MusicController::class, 'alternative'])->name('api.alternative');
Route::get('/api/stream/{videoId}', [MusicController::class, 'stream'])->name('api.stream');

