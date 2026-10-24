'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PagerProps {
  page: number;
  lastPage: number;
  onChange: (page: number) => void;
  className?: string;
}

function pages(current: number, last: number): (number | '…')[] {
  const set = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last));
  const sorted = Array.from(set).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

export function Pager({ page, lastPage, onChange, className }: PagerProps) {
  if (lastPage <= 1) return null;

  return (
    <nav className={cn('flex flex-wrap items-center justify-center gap-1.5', className)} aria-label="Pagination">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages(page, lastPage).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-2 text-sm text-muted-foreground">…</span>
        ) : (
          <Button
            key={p}
            variant={p === page ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className="min-w-9"
          >
            {p}
          </Button>
        )
      )}
      <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
