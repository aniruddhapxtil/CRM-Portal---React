import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  accent?: string;
  title?: ReactNode;
  actions?: ReactNode;
}

export function Card({ accent, title, actions, children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`}
      style={accent ? { borderTopWidth: 4, borderTopColor: accent } : undefined}
      {...props}
    >
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-2.5">
          {title && <h3 className="text-sm font-extrabold text-ink">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
