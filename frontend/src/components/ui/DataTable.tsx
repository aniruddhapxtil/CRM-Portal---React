import { useMemo, useState, type ReactNode } from "react";
import { Input } from "./Input";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Shown as the bold title on the stacked mobile card; exactly one column should set this. */
  primary?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => number | string;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  filterRow?: (row: T, query: string) => boolean;
  emptyMessage?: string;
  toolbarExtra?: ReactNode;
}

/** Registry table: real <table> at >=768px, stacked cards below. Client-side search only,
 * matching the backend's un-paginated /overview endpoints. */
export function DataTable<T>({
  rows,
  columns,
  getRowId,
  onRowClick,
  searchPlaceholder = "Search…",
  filterRow,
  emptyMessage = "No records yet.",
  toolbarExtra,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim() || !filterRow) return rows;
    return rows.filter((r) => filterRow(r, query.trim().toLowerCase()));
  }, [rows, query, filterRow]);

  const primaryCol = columns.find((c) => c.primary) ?? columns[0];
  const restCols = columns.filter((c) => c !== primaryCol);

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="max-w-xs"
        />
        {toolbarExtra}
        <span className="ml-auto text-xs font-semibold text-muted">{filtered.length} records</span>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted">{emptyMessage}</div>
      ) : (
        <>
          {/* Table: md and up */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-canvas/60 text-left text-xs font-bold text-muted">
                  {columns.map((c) => (
                    <th key={c.key} className="px-4 py-3">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={getRowId(row)}
                    onClick={() => onRowClick?.(row)}
                    className={`border-b border-border/70 last:border-0 transition-colors duration-150 ${onRowClick ? "cursor-pointer hover:bg-brand-tint/50" : ""}`}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stacked cards: below md */}
          <div className="divide-y divide-border md:hidden">
            {filtered.map((row) => (
              <div
                key={getRowId(row)}
                onClick={() => onRowClick?.(row)}
                className={`tap-target flex flex-col gap-1.5 p-4 transition-colors duration-150 ${onRowClick ? "cursor-pointer active:bg-canvas" : ""}`}
              >
                <div className="font-semibold text-ink">{primaryCol.render(row)}</div>
                {restCols.map((c) => (
                  <div key={c.key} className="flex justify-between gap-3 text-xs text-muted">
                    <span className="font-semibold">{c.header}</span>
                    <span className="text-right text-ink">{c.render(row)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
