import { cn } from '@/lib/utils';

export function StatusBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  );
}
