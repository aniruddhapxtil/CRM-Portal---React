import { useEffect, useRef, useState } from "react";

interface MultiSelectProps {
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

/** Checkbox-panel multi-select, used for Technology and Service Line. */
export function MultiSelect({ options, value, onChange, placeholder = "Select…" }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  }

  const label = value.length === 0 ? placeholder : value.length === 1 ? value[0] : `${value.length} selected`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="tap-target flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-left text-sm text-ink"
      >
        <span className={value.length === 0 ? "text-muted" : ""}>{label}</span>
        <span className="text-muted text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-surface p-2 shadow-lg">
          {options.map((opt) => (
            <label
              key={opt}
              className="tap-target flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-canvas"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-brand)]"
                checked={value.includes(opt)}
                onChange={() => toggle(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
