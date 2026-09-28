import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-brand text-ink hover:bg-brand-light disabled:bg-brand/40",
  outline: "bg-surface border border-border text-ink hover:bg-canvas",
  danger: "bg-danger text-white hover:bg-danger/90",
  ghost: "bg-transparent text-ink hover:bg-canvas",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`tap-target inline-flex items-center justify-center gap-2 rounded-lg px-4 font-semibold text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
