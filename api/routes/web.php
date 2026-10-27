<?php

use Illuminate\Support\Facades\Route;

// The API host has no pages of its own; send visitors (and crawlers) to the website.
Route::get('/', fn () => redirect()->away(config('app.frontend_url'), 301));
