'use client';

import type { ReactNode } from 'react';

/** Responsive row of filter controls above a list. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-6">{children}</div>;
}
