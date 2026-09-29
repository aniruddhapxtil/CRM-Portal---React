import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  // Gradient matches data-phi.ai's own CTA buttons (phi-genai-ai-and-ml page).
  primary: "text-white bg-[image:var(--cta-gradient)] shadow-sm hover:brightness-110 disabled:opacity-50",
  outline: "bg-surface border border-border text-ink hover:bg-canvas",
  danger: "bg-danger text-white hover:bg-danger/90",
  ghost: "bg-transparent text-ink hover:bg-canvas",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`tap-target inline-flex items-center justify-center gap-2 rounded-lg px-4 font-semibold text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
