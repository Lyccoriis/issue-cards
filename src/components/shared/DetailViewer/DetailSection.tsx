import type { ReactNode } from 'react';

export default function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h4 className="text-[11px] font-medium tracking-[0.06em] text-primary uppercase">{title}</h4>
      {children}
    </section>
  );
}
