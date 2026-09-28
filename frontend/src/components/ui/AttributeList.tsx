import { Input } from "./Input";
import { Button } from "./Button";

interface AttributeListProps {
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
}

/** Dynamic attribute_1..attribute_10 free-form field list ("+ Add Attribute" widget). */
export function AttributeList({ value, onChange, max = 10 }: AttributeListProps) {
  function setAt(i: number, v: string) {
    const next = [...value];
    next[i] = v;
    onChange(next);
  }

  function add() {
    if (value.length < max) onChange([...value, ""]);
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={v}
            onChange={(e) => setAt(i, e.target.value)}
            placeholder={`Attribute ${i + 1}`}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="tap-target rounded-md px-2 text-muted hover:bg-canvas hover:text-danger"
            aria-label="Remove attribute"
          >
            ✕
          </button>
        </div>
      ))}
      {value.length < max && (
        <Button type="button" variant="outline" onClick={add} className="self-start">
          + Add Attribute
        </Button>
      )}
    </div>
  );
}
