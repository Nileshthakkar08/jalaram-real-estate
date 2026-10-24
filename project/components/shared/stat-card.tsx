import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  href?: string;
  tone?: 'default' | 'warning' | 'success' | 'danger';
}

const tones = {
  default: 'text-primary',
  warning: 'text-amber-700',
  success: 'text-green-700',
  danger: 'text-red-700',
};

export function StatCard({ label, value, icon: Icon, hint, href, tone = 'default' }: StatCardProps) {
  const body = (
    <div className={cn('h-full rounded-xl border border-border bg-card p-4 transition-colors', href && 'hover:border-accent')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
      </div>
      <p className={cn('mt-2 font-serif text-2xl font-bold tabular-nums', tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return href ? <Link href={href} className="block">{body}</Link> : body;
}
