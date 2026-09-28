import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  accent?: string;
  title?: ReactNode;
  actions?: ReactNode;
}

export function Card({ accent, title, actions, children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-sm ${className}`}
      style={accent ? { borderTopWidth: 4, borderTopColor: accent } : undefined}
      {...props}
    >
      {/* Decorative watermark on the plain white card background — subtle, never blocks content. */}
      <img
        src="/genai-section-image.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-6 -right-6 z-0 hidden w-36 opacity-[0.06] select-none sm:block"
      />
      <div className="relative z-10">
        {(title || actions) && (
          <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-2.5">
            {title && <h3 className="text-sm font-extrabold text-ink">{title}</h3>}
            {actions}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
