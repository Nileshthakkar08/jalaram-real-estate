import type { ReactNode } from 'react';

/** Hero band + readable column used by static content pages. */
export function ContentHero({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: ReactNode }) {
  return (
    <section className="bg-primary py-14 lg:py-20">
      <div className="container-mw container-px text-primary-foreground">
        {eyebrow && <span className="text-sm font-medium uppercase tracking-wider text-accent">{eyebrow}</span>}
        <h1 className="mt-2 max-w-3xl text-balance font-serif text-3xl font-bold lg:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg text-primary-foreground/80">{intro}</p>}
      </div>
    </section>
  );
}

/** Typography for long-form text without the typography plugin. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:font-serif [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground [&_ul]:space-y-1.5">
      {children}
    </div>
  );
}
