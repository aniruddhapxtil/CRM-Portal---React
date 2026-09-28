import type { HTMLAttributes } from "react";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-canvas text-muted border-border",
  brand: "bg-brand-tint text-ink border-brand/40",
  success: "bg-success-light text-success border-success/30",
  warning: "bg-warning-light text-warning border-warning/30",
  danger: "bg-danger-light text-danger border-danger/30",
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
