<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;

class AuditLogger
{
    /** Fields that must never be written to the audit trail. */
    private const REDACTED = ['password', 'remember_token'];

    public function log(string $action, ?Model $subject = null, array $old = [], array $new = [], ?string $reason = null): AuditLog
    {
        $request = request();

        return AuditLog::create([
            'user_id' => auth()->id(),
            'action' => $action,
            'auditable_type' => $subject ? class_basename($subject) : null,
            'auditable_id' => $subject?->getKey(),
            'old_values' => $old ? Arr::except($old, self::REDACTED) : null,
            'new_values' => $new ? Arr::except($new, self::REDACTED) : null,
            'reason' => $reason,
            'ip_address' => $request?->ip(),
            'user_agent' => $request ? substr((string) $request->userAgent(), 0, 500) : null,
        ]);
    }

    /** Log only the attributes that actually changed on a model that is about to be (or was just) saved. */
    public function logChanges(string $action, Model $model, array $original, ?string $reason = null): ?AuditLog
    {
        $changes = $model->getChanges() ?: $model->getDirty();
        unset($changes['updated_at']);
        if ($changes === []) {
            return null;
        }

        return $this->log($action, $model, Arr::only($original, array_keys($changes)), $changes, $reason);
    }
}
