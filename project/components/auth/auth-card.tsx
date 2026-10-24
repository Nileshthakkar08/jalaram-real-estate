import type { ReactNode } from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="container-mw container-px flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <Link href="/" className="mb-6 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Home className="h-5 w-5 text-accent" strokeWidth={2.5} />
            </div>
            <span className="font-serif text-lg font-bold text-primary">Jalaram Real Estate</span>
          </Link>
          <h1 className="font-serif text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </section>
  );
}
