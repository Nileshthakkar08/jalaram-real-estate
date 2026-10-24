import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center" role="status" aria-label={label}>
      <Loader2 className="h-7 w-7 animate-spin text-accent" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-destructive/40 bg-card p-6 text-center" role="alert">
      <AlertTriangle className="h-8 w-8 text-destructive/70" />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-3 gap-2">
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-6 text-center">
      <Inbox className="h-9 w-9 text-muted-foreground/40" />
      <h3 className="mt-3 font-serif text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Renders loading / error / content for a useApi() result. */
export function DataState<T>({
  loading, error, data, onRetry, children,
}: { loading: boolean; error: string | null; data: T | null; onRetry?: () => void; children: (data: T) => ReactNode }) {
  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={onRetry} />;
  if (!data) return null;
  return <>{children(data)}</>;
}
