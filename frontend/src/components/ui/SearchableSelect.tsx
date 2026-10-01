import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchableOption {
  value: number | string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: number | string | null;
  onChange: (value: number | string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** When provided, a "+ Create '<query>'" row is offered whenever the typed text has no match. */
  onCreateNew?: (query: string) => void;
  createNewLabel?: (query: string) => string;
}

/** Typeahead combobox — replaces the old vanilla-JS searchable_select.js. */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search…",
  disabled,
  invalid,
  onCreateNew,
  createNewLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);
  // `value` doesn't have to be a known option's id — callers that store free text (e.g. a name
  // typed/spoken for a record that doesn't exist yet) pass that text straight through as `value`.
  // Fall back to showing it verbatim so a freshly-typed/extracted value isn't rendered as blank
  // just because it has no matching option yet.
  const displayValue = selected?.label ?? (typeof value === "string" ? value : "");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function commit(opt: SearchableOption | null) {
    onChange(opt ? opt.value : null);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) {
        commit(filtered[highlight]);
      } else if (onCreateNew && query.trim()) {
        // No existing option matches what was typed — same action as clicking the "+ Create…"
        // row, so Enter doesn't just silently drop the text the user (or the voice extractor) put here.
        onCreateNew(query.trim());
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        className={`tap-target w-full rounded-md border px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 ${
          invalid ? "border-danger bg-danger-light/40" : "border-border bg-surface"
        } ${disabled ? "cursor-not-allowed bg-canvas text-muted" : ""}`}
        value={open ? query : displayValue}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open && !disabled && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-surface shadow-lg">
          {filtered.length === 0 && !onCreateNew && <div className="px-3 py-2 text-sm text-muted">No matches</div>}
          {filtered.map((opt, i) => (
            <button
              type="button"
              key={opt.value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(opt)}
              className={`tap-target block w-full truncate px-3 py-2 text-left text-sm ${
                i === highlight ? "bg-brand-tint" : "hover:bg-canvas"
              } ${opt.value === value ? "font-semibold text-ink" : "text-ink/90"}`}
            >
              {opt.label}
            </button>
          ))}
          {onCreateNew && query.trim() && filtered.length === 0 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                onCreateNew(query.trim());
              }}
              className="tap-target block w-full truncate border-t border-border px-3 py-2 text-left text-sm font-semibold text-brand hover:bg-brand-tint"
            >
              {createNewLabel ? createNewLabel(query.trim()) : `+ Create "${query.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
