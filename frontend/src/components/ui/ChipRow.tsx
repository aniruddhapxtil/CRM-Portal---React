interface ChipRowProps {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}

/** Single-select pill row — used for Activity's record_type / record_action. */
export function ChipRow({ options, value, onChange }: ChipRowProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            type="button"
            key={opt}
            onClick={() => onChange(opt)}
            className={`tap-target rounded-full border px-3.5 text-sm font-semibold transition-colors ${
              active
                ? "border-brand bg-brand-tint text-ink"
                : "border-border bg-surface text-muted hover:bg-canvas"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
