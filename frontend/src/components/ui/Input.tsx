import type { InputHTMLAttributes, TextareaHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  helper?: ReactNode;
  error?: string;
}

export function FieldLabel({ required, helper, error, children, className = "", ...props }: FieldLabelProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className={`text-xs font-semibold text-ink flex justify-between ${className}`} {...props}>
        <span>
          {children}
          {required && <span className="text-danger ml-0.5">*</span>}
        </span>
      </label>
      {error ? (
        <span className="text-[11px] font-medium text-danger">{error}</span>
      ) : helper ? (
        <span className="text-[11px] text-muted">{helper}</span>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ invalid, className = "", ...props }: InputProps) {
  return (
    <input
      className={`tap-target w-full rounded-md border px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 ${
        invalid ? "border-danger bg-danger-light/40" : "border-border bg-surface"
      } ${className}`}
      {...props}
    />
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid, className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={`w-full rounded-md border px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 ${
        invalid ? "border-danger bg-danger-light/40" : "border-border bg-surface"
      } ${className}`}
      {...props}
    />
  );
}
