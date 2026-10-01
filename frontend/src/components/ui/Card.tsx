import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  accent?: string;
  /** Soft corner-glow wash behind the card content — pass a `var(--color-accent-*-tint)`
   * (or any CSS color) to tint the card toward that section's identity. */
  fade?: string;
  title?: ReactNode;
  actions?: ReactNode;
}

export function Card({ accent, fade, title, actions, children, className = "", style, ...props }: CardProps) {
  const mergedStyle: CSSProperties = {
    ...(accent ? { borderTopWidth: 4, borderTopColor: accent } : undefined),
    ...(fade ? ({ "--fade-from": fade } as CSSProperties) : undefined),
    ...style,
  };
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow duration-200 hover:shadow-md ${fade ? "surface-fade" : ""} ${className}`}
      style={mergedStyle}
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
