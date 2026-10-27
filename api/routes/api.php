<?php

use App\Http\Controllers\Api\Admin\AdminController;
use App\Http\Controllers\Api\Admin\AdminPropertyController;
use App\Http\Controllers\Api\Admin\BrokerageRuleController;
use App\Http\Controllers\Api\Admin\CatalogAdminController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Owner\OwnerPropertyController;
use App\Http\Controllers\Api\Owner\PropertyImageController;
use App\Http\Controllers\Api\Public\CatalogController;
use App\Http\Controllers\Api\Public\EnquiryController;
use App\Http\Controllers\Api\Public\PropertySearchController;
use App\Http\Controllers\Api\Public\PushSubscriptionController;
use App\Http\Controllers\Api\Team\BrokerageController;
use App\Http\Controllers\Api\Team\CustomerController;
use App\Http\Controllers\Api\Team\DealController;
use App\Http\Controllers\Api\Team\DealDocumentController;
use App\Http\Controllers\Api\Team\FollowUpController;
use App\Http\Controllers\Api\Team\LeadController;
use App\Http\Controllers\Api\Team\SiteVisitController;
use App\Http\Controllers\Api\Team\TeamDashboardController;
use App\Http\Controllers\Api\Team\TeamPropertyController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // ---------- Public ----------
    Route::get('settings/public', [CatalogController::class, 'settings']);
    Route::get('localities', [CatalogController::class, 'localities']);
    Route::get('localities/{slug}', [CatalogController::class, 'locality']);
    Route::get('amenities', [CatalogController::class, 'amenities']);
    Route::get('sitemap', [CatalogController::class, 'sitemap']);
    Route::get('properties', [PropertySearchController::class, 'index']);
    Route::get('properties/{slug}', [PropertySearchController::class, 'show']);

    Route::get('push/public-key', [PushSubscriptionController::class, 'publicKey']);
    Route::middleware('throttle:push')->group(function () {
        Route::post('push/subscriptions', [PushSubscriptionController::class, 'store']);
        Route::delete('push/subscriptions', [PushSubscriptionController::class, 'destroy']);
    });

    Route::middleware('throttle:enquiries')->group(function () {
        Route::post('enquiries', [EnquiryController::class, 'store']);
        Route::post('site-visit-requests', [EnquiryController::class, 'siteVisit']);
    });

    // ---------- Authentication ----------
    Route::prefix('auth')->group(function () {
        Route::middleware('throttle:auth')->group(function () {
            Route::post('register', [AuthController::class, 'register']);
            Route::post('login', [AuthController::class, 'login']);
            Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
            Route::post('reset-password', [AuthController::class, 'resetPassword']);
        });
        Route::get('verify-email/{id}/{hash}', [AuthController::class, 'verify'])
            ->middleware('throttle:6,1')->name('verification.verify');

        Route::middleware(['auth:sanctum', 'role'])->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::get('user', [AuthController::class, 'user']);
            Route::put('profile', [AuthController::class, 'updateProfile']);
            Route::put('password', [AuthController::class, 'updatePassword']);
            Route::post('email/verification-notification', [AuthController::class, 'sendVerification'])->middleware('throttle:6,1');
        });
    });

    // ---------- Owner portal ----------
    Route::prefix('owner')->middleware(['auth:sanctum', 'role:owner'])->group(function () {
        Route::get('dashboard', [OwnerPropertyController::class, 'dashboard']);
        Route::get('properties', [OwnerPropertyController::class, 'index']);
        Route::post('properties', [OwnerPropertyController::class, 'store']);
        Route::get('properties/{property}', [OwnerPropertyController::class, 'show']);
        Route::put('properties/{property}', [OwnerPropertyController::class, 'update']);
        Route::delete('properties/{property}', [OwnerPropertyController::class, 'destroy']);
        Route::post('properties/{property}/submit', [OwnerPropertyController::class, 'submit']);
        Route::post('properties/{property}/availability', [OwnerPropertyController::class, 'availability']);
        Route::post('properties/{property}/close', [OwnerPropertyController::class, 'close']);
        Route::post('properties/{property}/images', [PropertyImageController::class, 'store'])->middleware('throttle:uploads');
        Route::put('properties/{property}/images/order', [PropertyImageController::class, 'reorder']);
        Route::delete('properties/{property}/images/{image}', [PropertyImageController::class, 'destroy']);
    });

    // ---------- Team workspace (team members + admins) ----------
    Route::prefix('team')->middleware(['auth:sanctum', 'role:team_member,admin'])->group(function () {
        Route::get('dashboard', [TeamDashboardController::class, 'dashboard']);
        Route::get('members', [TeamDashboardController::class, 'members']);
        Route::get('notifications', [TeamDashboardController::class, 'notifications']);
        Route::post('notifications/read', [TeamDashboardController::class, 'markNotificationsRead']);

        Route::get('leads', [LeadController::class, 'index']);
        Route::post('leads', [LeadController::class, 'store']);
        Route::get('leads/{lead}', [LeadController::class, 'show']);
        Route::put('leads/{lead}', [LeadController::class, 'update']);
        Route::post('leads/{lead}/assign', [LeadController::class, 'assign']);
        Route::post('leads/{lead}/status', [LeadController::class, 'status']);
        Route::post('leads/{lead}/activities', [LeadController::class, 'addActivity']);
        Route::post('leads/{lead}/follow-ups', [LeadController::class, 'addFollowUp']);

        Route::get('follow-ups', [FollowUpController::class, 'index']);
        Route::patch('follow-ups/{followUp}', [FollowUpController::class, 'update']);

        Route::get('site-visits', [SiteVisitController::class, 'index']);
        Route::post('site-visits', [SiteVisitController::class, 'store']);
        Route::patch('site-visits/{siteVisit}', [SiteVisitController::class, 'update']);

        Route::get('properties', [TeamPropertyController::class, 'index']);
        Route::get('properties/{property}', [TeamPropertyController::class, 'show']);
        Route::post('properties/{property}/owner-notes', [TeamPropertyController::class, 'addOwnerNote']);

        Route::get('customers', [CustomerController::class, 'index']);

        Route::get('deals', [DealController::class, 'index']);
        Route::post('deals', [DealController::class, 'store']);
        Route::get('deals/{deal}', [DealController::class, 'show']);
        Route::put('deals/{deal}', [DealController::class, 'update']);
        Route::post('deals/{deal}/status', [DealController::class, 'status']);
        Route::post('deals/{deal}/reapply-rule', [DealController::class, 'reapplyRule']);
        Route::post('deals/{deal}/agreements', [BrokerageController::class, 'storeAgreement']);
        Route::post('deals/{deal}/documents', [DealDocumentController::class, 'store'])->middleware('throttle:uploads');

        Route::patch('agreements/{agreement}', [BrokerageController::class, 'updateAgreement']);
        Route::post('agreements/{agreement}/payments', [BrokerageController::class, 'storePayment']);
        Route::post('payments/{payment}/void', [BrokerageController::class, 'voidPayment']);
        Route::get('documents/{document}/download', [DealDocumentController::class, 'download']);
        Route::delete('documents/{document}', [DealDocumentController::class, 'destroy']);

        Route::post('brokerage/estimate', [BrokerageController::class, 'estimate']);
        Route::get('brokerage/summary', [BrokerageController::class, 'summary']);
    });

    // ---------- Moderation (admins + team members with properties.moderate; checked by policy) ----------
    Route::prefix('admin')->middleware(['auth:sanctum', 'role:team_member,admin'])->group(function () {
        Route::get('properties', [AdminPropertyController::class, 'index']);
        Route::get('properties/{property}', [AdminPropertyController::class, 'show']);
        Route::put('properties/{property}', [AdminPropertyController::class, 'update']);
        Route::post('properties/{property}/approve', [AdminPropertyController::class, 'approve']);
        Route::post('properties/{property}/reject', [AdminPropertyController::class, 'reject']);
        Route::post('properties/{property}/status', [AdminPropertyController::class, 'status']);
        Route::post('properties/{property}/feature', [AdminPropertyController::class, 'feature']);
        Route::post('properties/{property}/images', [PropertyImageController::class, 'store'])->middleware('throttle:uploads');
        Route::put('properties/{property}/images/order', [PropertyImageController::class, 'reorder']);
        Route::delete('properties/{property}/images/{image}', [PropertyImageController::class, 'destroy']);
    });

    // ---------- Admin only ----------
    Route::prefix('admin')->middleware(['auth:sanctum', 'role:admin'])->group(function () {
        Route::get('dashboard', [AdminController::class, 'dashboard']);
        Route::get('settings', [AdminController::class, 'settings']);
        Route::put('settings', [AdminController::class, 'updateSettings']);
        Route::get('audit-logs', [AdminController::class, 'auditLogs']);
        Route::get('reports/finance', [AdminController::class, 'financeReport']);

        Route::get('users', [UserController::class, 'index']);
        Route::post('users', [UserController::class, 'store']);
        Route::put('users/{user}', [UserController::class, 'update']);

        Route::get('localities', [CatalogAdminController::class, 'localities']);
        Route::post('localities', [CatalogAdminController::class, 'storeLocality']);
        Route::put('localities/{locality}', [CatalogAdminController::class, 'updateLocality']);
        Route::delete('localities/{locality}', [CatalogAdminController::class, 'destroyLocality']);
        Route::get('amenities', [CatalogAdminController::class, 'amenities']);
        Route::post('amenities', [CatalogAdminController::class, 'storeAmenity']);
        Route::put('amenities/{amenity}', [CatalogAdminController::class, 'updateAmenity']);
        Route::delete('amenities/{amenity}', [CatalogAdminController::class, 'destroyAmenity']);

        Route::post('brokerage-rules/preview', [BrokerageRuleController::class, 'preview']);
        Route::apiResource('brokerage-rules', BrokerageRuleController::class)->parameters(['brokerage-rules' => 'brokerageRule']);
    });
});
