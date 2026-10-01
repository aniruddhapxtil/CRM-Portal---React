import type { HTMLAttributes } from "react";

export type Tone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "tealblue"
  | "royalblue"
  | "amber"
  | "royalpurple"
  | "neongreen"
  | "yellow";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-canvas text-muted border-border",
  brand: "bg-brand-tint text-ink border-brand/40",
  success: "bg-success-light text-success border-success/30",
  warning: "bg-warning-light text-warning border-warning/30",
  danger: "bg-danger-light text-danger border-danger/30",
  // Playful accent tones — section/entity coding (Voice Station, service lines), not semantic state.
  tealblue: "bg-accent-tealblue-tint text-accent-tealblue border-accent-tealblue/30",
  royalblue: "bg-accent-royalblue-tint text-accent-royalblue border-accent-royalblue/30",
  amber: "bg-accent-amber-tint text-accent-amber border-accent-amber/30",
  royalpurple: "bg-accent-royalpurple-tint text-accent-royalpurple border-accent-royalpurple/30",
  neongreen: "bg-accent-neongreen-tint text-accent-neongreen border-accent-neongreen/30",
  yellow: "bg-accent-yellow-tint text-accent-yellow border-accent-yellow/30",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    />
  );
}
