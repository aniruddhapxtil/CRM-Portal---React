import type { ReactNode } from "react";

interface PageHeaderProps {
  crumb?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ crumb, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface p-5">
      <div>
        {crumb && (
          <div className="breadcrumb-pill mb-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">
            {crumb}
          </div>
        )}
        <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
