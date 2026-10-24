import Link from 'next/link';
import { Home, Search } from 'lucide-react';
import { PublicLayout } from '@/components/site/public-layout';

export default function NotFound() {
  return (
    <PublicLayout>
      <section className="container-mw container-px flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <p className="font-serif text-6xl font-bold text-accent">404</p>
        <h1 className="mt-4 font-serif text-3xl font-bold">This page isn&apos;t available</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          The page may have moved, or the property may no longer be listed.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <Home className="h-4 w-4" /> Home
          </Link>
          <Link href="/buy" className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:bg-muted">
            <Search className="h-4 w-4" /> Browse properties
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
