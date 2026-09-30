import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Select } from "../../components/ui/Select";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { getDashboardSummary, updateOpportunityExpectedClosureDate } from "../../api/dashboard";
import { useAuth } from "../../context/AuthContext";
import { REGION_OPTIONS, SOURCE_OPTIONS, PROJECT_TYPE_OPTIONS, OPPORTUNITY_STAGE_WON, OPPORTUNITY_STAGE_LOST } from "../../constants/options";
import type { CurrencyAmount, DashboardDealTrackingRow, DashboardPeriod, DashboardSummary, ForecastGrid, ForecastGridCell } from "../../types/entities";

const DONUT_COLORS = ["var(--color-brand)", "var(--color-brand-cyan)", "var(--color-warning)", "var(--color-danger)", "var(--color-brand-light)", "var(--color-muted)"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const PERIODS: { key: DashboardPeriod; label: string }[] = [
  { key: "mtd", label: "MTD" },
  { key: "qtd", label: "QTD" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All Time" },
];

function formatAmounts(amounts: CurrencyAmount[]): string {
  if (amounts.length === 0) return "—";
  return amounts
    .map((a) => `${a.currency} ${a.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`)
    .join(" + ");
}

function primaryValue(amounts: CurrencyAmount[]): number {
  return amounts[0]?.amount ?? 0;
}

function groupByCurrency(items: { currency: string; amount: number }[]): CurrencyAmount[] {
  const totals = new Map<string, number>();
  for (const it of items) totals.set(it.currency, (totals.get(it.currency) ?? 0) + it.amount);
  return Array.from(totals.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Only Admin/Team Lead may edit here — Executive is a read-only role app-wide (backend enforces this too). */
const PROBABILITY_THRESHOLD = 60;

function stageTone(stage: string): "success" | "danger" | "brand" | "warning" {
  if (stage === OPPORTUNITY_STAGE_WON) return "success";
  if (stage === OPPORTUNITY_STAGE_LOST) return "danger";
  if (stage.startsWith("Proposal")) return "brand";
  return "warning";
}

export function HomePage() {
  const navigate = useNavigate();
  const user = useAuth();
  const firstName = user.name.split(" ")[0];
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<DashboardPeriod>("qtd");
  const [accountManager, setAccountManager] = useState("");
  const [region, setRegion] = useState("");
  const [source, setSource] = useState("");
  const [projectType, setProjectType] = useState("");
  const [thresholdOnly, setThresholdOnly] = useState(true);
  const [editingCellId, setEditingCellId] = useState<number | null>(null);
  const [editingDateValue, setEditingDateValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const canEditDashboard = user.role !== "Executive";

  const fetchDashboard = () => {
    setLoading(true);
    return getDashboardSummary({
      period,
      account_manager: accountManager || undefined,
      region: region || undefined,
      source: source || undefined,
      project_type: projectType || undefined,
    })
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, accountManager, region, source, projectType]);

  const hasFilters = accountManager || region || source || projectType;

  const filteredGrid: ForecastGrid | null = useMemo(() => {
    if (!data) return null;
    const grid = data.forecast_grid;
    if (!thresholdOnly) return grid;

    const rows = grid.rows
      .map((row) => {
        const cells: Record<string, ForecastGridCell[]> = {};
        for (const key of Object.keys(row.cells)) {
          cells[key] = row.cells[key].filter((c) => c.probability > PROBABILITY_THRESHOLD);
        }
        const allCells = Object.values(cells).flat();
        return {
          manager_name: row.manager_name,
          cells,
          total_amounts: groupByCurrency(allCells.map((c) => ({ currency: c.currency, amount: c.deal_size }))),
        };
      })
      .filter((row) => Object.values(row.cells).some((arr) => arr.length > 0));

    const month_totals: Record<string, CurrencyAmount[]> = {};
    for (const m of grid.months) {
      const allForMonth = rows.flatMap((r) => r.cells[m.key] ?? []);
      month_totals[m.key] = groupByCurrency(allForMonth.map((c) => ({ currency: c.currency, amount: c.deal_size })));
    }

    return { months: grid.months, quarters: grid.quarters, rows, month_totals };
  }, [data, thresholdOnly]);

  const funnelMax = useMemo(() => Math.max(1, ...(data?.funnel.map((f) => f.count) ?? [1])), [data]);
  const typeMax = useMemo(
    () => Math.max(1, ...(data?.pipeline_by_type.map((t) => primaryValue(t.amounts)) ?? [1])),
    [data],
  );
  const forecastMax = useMemo(
    () => Math.max(1, ...(data?.forecast_by_month.map((m) => primaryValue(m.weighted_amounts)) ?? [1])),
    [data],
  );
  const donutGradient = useMemo(() => {
    if (!data || data.lead_source_mix.length === 0) return "conic-gradient(var(--color-border) 0 100%)";
    let cursor = 0;
    const stops = data.lead_source_mix.map((slice, i) => {
      const start = cursor;
      cursor += slice.pct;
      return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [data]);

  const trendMax = useMemo(
    () => Math.max(1, ...(data?.closed_won_trend.map((m) => primaryValue(m.amounts)) ?? [1])),
    [data],
  );

  const quarterTotals = useMemo(() => {
    if (!filteredGrid) return [];
    const grid = filteredGrid;
    let cursor = 0;
    return grid.quarters.map((q) => {
      const monthKeys = grid.months.slice(cursor, cursor + q.span).map((m) => m.key);
      cursor += q.span;
      const totals = new Map<string, number>();
      for (const key of monthKeys) {
        for (const a of grid.month_totals[key] ?? []) {
          totals.set(a.currency, (totals.get(a.currency) ?? 0) + a.amount);
        }
      }
      return Array.from(totals.entries())
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((a, b) => b.amount - a.amount);
    });
  }, [filteredGrid]);

  const movementMax = useMemo(() => {
    if (!data) return 1;
    const vals = [
      primaryValue(data.pipeline_movement.opening),
      primaryValue(data.pipeline_movement.new_added),
      primaryValue(data.pipeline_movement.won),
      primaryValue(data.pipeline_movement.lost),
      primaryValue(data.pipeline_movement.closing),
    ];
    return Math.max(1, ...vals);
  }, [data]);

  function startEditingDate(c: ForecastGridCell) {
    setEditingCellId(c.id);
    setEditingDateValue(c.expected_closure_date ?? "");
  }

  async function saveEditingDate(opportunityId: number) {
    setSavingEdit(true);
    try {
      await updateOpportunityExpectedClosureDate(opportunityId, editingDateValue || null);
      setEditingCellId(null);
      await fetchDashboard();
    } finally {
      setSavingEdit(false);
    }
  }

  const dealColumns: DataTableColumn<DashboardDealTrackingRow>[] = [
    {
      key: "opportunity_name",
      header: "Opportunity",
      primary: true,
      render: (r) => (
        <span className="flex items-center font-semibold">
          <span className="mr-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-canvas text-[10px] font-bold text-muted">
            {initials(r.account_name)}
          </span>
          {r.opportunity_name}
        </span>
      ),
    },
    { key: "account_name", header: "Account", render: (r) => r.account_name },
    { key: "stage", header: "Stage", render: (r) => <Badge tone={stageTone(r.stage)}>{r.stage}</Badge> },
    { key: "deal_size", header: "Value", render: (r) => `${r.currency} ${r.deal_size.toLocaleString()}` },
    { key: "expected_closure_date", header: "Expected Close", render: (r) => r.expected_closure_date ?? "—" },
  ];

  return (
    <AppLayout>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle={data ? `Here's how the pipeline is tracking · ${data.period.start ? `${data.period.start} → ${data.period.end}` : "all time"}` : "Loading…"}
        actions={
          <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  period === p.key ? "bg-[image:var(--cta-gradient)] text-white" : "text-muted hover:bg-canvas"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Filters */}
      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-muted">Filter by:</span>
          <Select
            options={data?.available_account_managers ?? []}
            placeholder="All Account Managers"
            value={accountManager}
            onChange={(e) => setAccountManager(e.target.value)}
            className="max-w-[200px]"
          />
          <Select options={REGION_OPTIONS} placeholder="All Regions" value={region} onChange={(e) => setRegion(e.target.value)} className="max-w-[180px]" />
          <Select options={SOURCE_OPTIONS} placeholder="All Sources" value={source} onChange={(e) => setSource(e.target.value)} className="max-w-[180px]" />
          <Select options={PROJECT_TYPE_OPTIONS} placeholder="Engagement Model" value={projectType} onChange={(e) => setProjectType(e.target.value)} className="max-w-[180px]" />
          {hasFilters && (
            <button
              type="button"
              className="ml-auto text-xs font-bold text-brand"
              onClick={() => {
                setAccountManager("");
                setRegion("");
                setSource("");
                setProjectType("");
              }}
            >
              Clear all
            </button>
          )}
        </div>
      </Card>

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <Card>
          <div className="mb-2 text-xs font-semibold text-muted">Open Leads</div>
          <div className="text-xl font-extrabold text-ink">{loading ? "…" : data?.kpis.open_lead_count ?? 0}</div>
        </Card>
        <Card>
          <div className="mb-2 text-xs font-semibold text-muted">Open Opportunities</div>
          <div className="text-xl font-extrabold text-ink">{loading ? "…" : data?.kpis.open_deal_count ?? 0}</div>
        </Card>
        <Card>
          <div className="mb-2 text-xs font-semibold text-muted">Open Pipeline</div>
          <div className="text-xl font-extrabold text-ink">{loading ? "…" : formatAmounts(data?.kpis.open_pipeline ?? [])}</div>
        </Card>
        <Card>
          <div className="mb-2 text-xs font-semibold text-muted">Closed Won (period)</div>
          <div className="text-xl font-extrabold text-success">{loading ? "…" : formatAmounts(data?.kpis.closed_won ?? [])}</div>
        </Card>
        <Card>
          <div className="mb-2 text-xs font-semibold text-muted">Win Rate (period)</div>
          <div className="text-xl font-extrabold text-ink">{loading ? "…" : data?.kpis.win_rate_pct !== null && data?.kpis.win_rate_pct !== undefined ? `${data.kpis.win_rate_pct}%` : "—"}</div>
        </Card>
        <Card>
          <div className="mb-2 text-xs font-semibold text-muted">Avg. Sales Cycle</div>
          <div className="text-xl font-extrabold text-ink">{loading ? "…" : data?.kpis.avg_cycle_days !== null && data?.kpis.avg_cycle_days !== undefined ? `${data.kpis.avg_cycle_days} days` : "—"}</div>
        </Card>
        <Card>
          <div className="mb-2 text-xs font-semibold text-muted">Projects in Delivery</div>
          <div className="text-xl font-extrabold text-ink">{loading ? "…" : data?.kpis.projects_in_delivery ?? 0}</div>
        </Card>
      </div>

      {/* Monthly Deal Tracker: open deals by Account Manager x expected close month */}
      <Card
        title="Monthly Deal Tracker"
        className="mb-6"
        actions={
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-muted">
            <input
              type="checkbox"
              checked={thresholdOnly}
              onChange={(e) => setThresholdOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-brand"
            />
            High-probability only (&gt;{PROBABILITY_THRESHOLD}%)
          </label>
        }
      >
        <p className="mb-4 text-xs text-muted">
          Grouped by Account Manager · card = deal name, value, stage, probability, expected close · month is set by the
          Opportunity's Expected Closure Date
        </p>
        {(!filteredGrid || filteredGrid.rows.length === 0) ? (
          <p className="text-sm text-muted">
            {loading
              ? "Loading…"
              : thresholdOnly
                ? `No open opportunities above ${PROBABILITY_THRESHOLD}% probability with an expected close date yet.`
                : "No open opportunities with an expected close date yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${210 + filteredGrid.months.length * 150}px` }}>
              {/* Quarter header */}
              <div className="grid gap-2.5" style={{ gridTemplateColumns: `210px repeat(${filteredGrid.months.length}, 1fr)` }}>
                <div />
                {filteredGrid.quarters.map((q, i) => (
                  <div key={`${q.label}-${i}`} style={{ gridColumn: `span ${q.span}` }} className="flex items-center gap-2 px-1">
                    <span className="whitespace-nowrap text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
                      {q.label} · {formatAmounts(quarterTotals[i] ?? [])}
                    </span>
                    <div className="h-[3px] flex-1 rounded bg-[image:var(--cta-gradient)]" />
                  </div>
                ))}
              </div>

              {/* Month header */}
              <div
                className="mb-1 grid gap-2.5 border-b border-border pb-2"
                style={{ gridTemplateColumns: `210px repeat(${filteredGrid.months.length}, 1fr)` }}
              >
                <div />
                {filteredGrid.months.map((m) => (
                  <div key={m.key} className="text-center text-[11.5px] font-bold text-muted">{m.label}</div>
                ))}
              </div>

              {/* Rows */}
              <div className="flex flex-col gap-3 pt-2.5">
                {filteredGrid.rows.map((row) => (
                  <div
                    key={row.manager_name}
                    className="grid items-center gap-2.5 rounded-xl border border-border bg-canvas p-3 transition-colors hover:border-brand"
                    style={{ gridTemplateColumns: `210px repeat(${filteredGrid.months.length}, 1fr)` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[image:var(--cta-gradient)] text-xs font-extrabold text-white">
                        {initials(row.manager_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-bold text-ink">{row.manager_name}</div>
                        <div className="truncate text-[10.5px] text-muted">{formatAmounts(row.total_amounts)} in flight</div>
                      </div>
                    </div>
                    {filteredGrid.months.map((m) => (
                      <div key={m.key} className="flex min-h-[64px] flex-col justify-center gap-1.5">
                        {(row.cells[m.key] ?? []).length === 0 ? (
                          <div className="min-h-8 rounded-md border border-dashed border-border" />
                        ) : (
                          row.cells[m.key].map((c) => {
                            const tone =
                              c.stage_label === "Won"
                                ? "var(--color-success)"
                                : c.probability >= 80
                                  ? "var(--color-brand)"
                                  : c.probability >= 60
                                    ? "var(--color-brand-cyan)"
                                    : "var(--color-warning)";
                            const isEditing = editingCellId === c.id;
                            return (
                              <div
                                key={c.id}
                                onClick={() => !isEditing && navigate(`/opportunities/${c.id}/edit`)}
                                className="cursor-pointer rounded-md bg-surface px-2.5 py-2 text-[11px] shadow-sm transition-transform hover:-translate-y-0.5"
                                style={{ borderLeft: `3px solid ${tone}` }}
                              >
                                <div className="mb-1 truncate font-bold text-ink" title={c.opportunity_name}>{c.opportunity_name}</div>
                                <div className="flex items-baseline justify-between gap-1.5">
                                  <span className="font-extrabold text-ink">{c.currency} {c.deal_size.toLocaleString()}</span>
                                  <span className="whitespace-nowrap rounded-full bg-canvas px-1.5 py-0.5 text-[9.5px] font-bold text-muted">{c.stage_label}</span>
                                </div>
                                <div className="mt-1.5 h-1 overflow-hidden rounded bg-canvas">
                                  <div className="h-full rounded bg-[image:var(--cta-gradient)]" style={{ width: `${c.probability}%` }} />
                                </div>
                                {isEditing ? (
                                  <div className="mt-1.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="date"
                                      value={editingDateValue}
                                      onChange={(e) => setEditingDateValue(e.target.value)}
                                      className="w-full rounded border border-border bg-canvas px-1 py-0.5 text-[10px] text-ink"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      disabled={savingEdit}
                                      onClick={() => saveEditingDate(c.id)}
                                      className="shrink-0 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white disabled:opacity-50"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingEdit}
                                      onClick={() => setEditingCellId(null)}
                                      className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-bold text-muted"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div className="mt-1 flex items-center justify-between gap-1 text-[9.5px] text-muted">
                                    <span>Expected close · {m.label}</span>
                                    {canEditDashboard && (
                                      <button
                                        type="button"
                                        title="Edit expected close date"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEditingDate(c);
                                        }}
                                        className="shrink-0 text-muted hover:text-brand"
                                      >
                                        ✎
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Sales Funnel + Lead Source Mix */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Sales Funnel — Deal Count by Stage" className="lg:col-span-2">
          {data && data.funnel.every((f) => f.count === 0) && !loading && (
            <p className="mb-3 text-sm text-muted">No leads or opportunities in this period yet — add some and this fills in automatically.</p>
          )}
          <div className="flex flex-col gap-2.5">
            {(data?.funnel ?? []).map((f) => (
              <div key={f.stage} className="flex items-center gap-3">
                <div className="w-40 shrink-0 truncate text-xs text-muted" title={f.stage}>{f.stage}</div>
                <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-canvas">
                  <div
                    className="flex h-full items-center justify-end rounded-lg bg-[image:var(--cta-gradient)] px-2 text-[11px] font-extrabold text-white transition-all"
                    style={{ width: `${Math.max((f.count / funnelMax) * 100, f.count > 0 ? 6 : 0)}%` }}
                  >
                    {f.count > 0 ? `${f.count}` : ""}
                  </div>
                </div>
                <div className="w-32 shrink-0 text-right text-xs font-semibold text-ink">{formatAmounts(f.amounts)}</div>
                <div className="w-14 shrink-0 text-right text-[11px] text-muted">{f.conversion_pct !== null ? `${f.conversion_pct}%` : ""}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Lead Source Mix" className="lg:col-span-1">
          {(!data || data.lead_source_mix.length === 0) ? (
            <p className="text-sm text-muted">No leads in this period yet.</p>
          ) : (
            <div className="flex items-center gap-5">
              <div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: donutGradient }}>
                <div className="absolute inset-3 flex items-center justify-center rounded-full bg-surface text-xs font-bold text-muted">
                  {data.lead_source_mix.reduce((s, x) => s + x.count, 0)} leads
                </div>
              </div>
              <div className="flex flex-col gap-1.5 text-xs">
                {data.lead_source_mix.map((s, i) => (
                  <div key={s.source} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="text-muted">{s.source} — {s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pipeline by contract type */}
        <Card title="Open Pipeline by Engagement Model">
          <div className="flex h-40 items-end gap-4">
            {(data?.pipeline_by_type ?? []).map((t) => (
              <div key={t.type} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="text-xs font-bold text-ink">{formatAmounts(t.amounts)}</div>
                <div
                  className="w-full max-w-10 rounded-t-md bg-brand"
                  style={{ height: `${Math.max((primaryValue(t.amounts) / typeMax) * 100, primaryValue(t.amounts) > 0 ? 4 : 0)}%` }}
                />
                <div className="text-[11px] text-muted">{t.type}</div>
              </div>
            ))}
            {(!data || data.pipeline_by_type.length === 0) && <div className="flex-1 self-center text-center text-sm text-muted">No open pipeline yet.</div>}
          </div>
        </Card>

        {/* Weighted forecast */}
        <Card title="Weighted Forecast by Expected Closure Month">
          <div className="flex h-40 items-end gap-3">
            {(data?.forecast_by_month ?? []).map((m) => (
              <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="text-[10px] font-bold text-ink">{m.deal_count > 0 ? formatAmounts(m.weighted_amounts) : ""}</div>
                <div
                  className="w-full max-w-8 rounded-t-md bg-brand-cyan"
                  style={{ height: `${Math.max((primaryValue(m.weighted_amounts) / forecastMax) * 100, primaryValue(m.weighted_amounts) > 0 ? 4 : 0)}%` }}
                />
                <div className="text-[11px] text-muted">{m.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Closed Won trend + Needs Attention */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Closed Won Value by Month">
          <p className="mb-3 text-xs text-muted">Trailing 6 months</p>
          <div className="flex h-40 items-end gap-3">
            {(data?.closed_won_trend ?? []).map((m) => (
              <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="text-[10px] font-bold text-ink">{primaryValue(m.amounts) > 0 ? formatAmounts(m.amounts) : ""}</div>
                <div
                  className="w-full max-w-8 rounded-t-md bg-success"
                  style={{ height: `${Math.max((primaryValue(m.amounts) / trendMax) * 100, primaryValue(m.amounts) > 0 ? 4 : 0)}%` }}
                />
                <div className="text-[11px] text-muted">{m.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Needs Attention">
          <p className="mb-3 text-xs text-muted">Open deals with no activity logged in 7+ days</p>
          {(data?.needs_attention.length ?? 0) === 0 ? (
            <p className="text-sm text-muted">{loading ? "Loading…" : "Nothing stalled right now — all open deals have recent activity."}</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {data!.needs_attention.map((n) => (
                <div
                  key={n.id}
                  className="flex cursor-pointer items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  onClick={() => navigate(`/opportunities/${n.id}/edit`)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{n.opportunity_name}</div>
                    <div className="truncate text-xs text-muted">{n.account_name} · {n.stage}</div>
                  </div>
                  <Badge tone="warning">{n.days_idle}d idle</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Pipeline movement */}
      <Card title="Pipeline Movement — Opening → New → Won → Lost → Closing" className="mb-6">
        <div className="flex h-44 items-end gap-2 px-2">
          {[
            { label: "Opening Pipeline", amounts: data?.pipeline_movement.opening ?? [], color: "bg-muted" },
            { label: "New Pipeline Added", amounts: data?.pipeline_movement.new_added ?? [], color: "bg-brand" },
            { label: "Won (moved out)", amounts: data?.pipeline_movement.won ?? [], color: "bg-success" },
            { label: "Lost (moved out)", amounts: data?.pipeline_movement.lost ?? [], color: "bg-danger" },
            { label: "Closing Pipeline", amounts: data?.pipeline_movement.closing ?? [], color: "bg-muted" },
          ].map((col) => (
            <div key={col.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div className="text-[11px] font-bold text-ink">{formatAmounts(col.amounts)}</div>
              <div
                className={`w-full max-w-16 rounded-t-md ${col.color}`}
                style={{ height: `${Math.max((primaryValue(col.amounts) / movementMax) * 100, primaryValue(col.amounts) > 0 ? 4 : 0)}%` }}
              />
              <div className="text-center text-[11px] text-muted">{col.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Deal tracking + Recent activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Deal Tracking — Open Opportunities by Expected Close" className="lg:col-span-2">
          <DataTable
            rows={data?.deal_tracking ?? []}
            columns={dealColumns}
            getRowId={(r) => r.id}
            onRowClick={(r) => navigate(`/opportunities/${r.id}/edit`)}
            searchPlaceholder="Search deals…"
            filterRow={(r, q) => r.opportunity_name.toLowerCase().includes(q) || r.account_name.toLowerCase().includes(q)}
            emptyMessage={loading ? "Loading…" : "No open opportunities yet."}
          />
        </Card>

        <Card title="Recent Activity" className="lg:col-span-1">
          <p className="mb-3 text-xs text-muted">Across all accounts</p>
          {(data?.recent_activity.length ?? 0) === 0 ? (
            <p className="text-sm text-muted">{loading ? "Loading…" : "No activity logged yet."}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data!.recent_activity.map((a) => (
                <div key={a.id} className="flex gap-2.5">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0 text-sm">
                    <p className="leading-snug">
                      <span className="font-bold">{a.record_action ?? a.activity_name}</span>{a.linked_name !== "—" ? ` — ${a.linked_name}` : ""}
                    </p>
                    <div className="text-[11px] text-muted">{a.actor} · {a.activity_date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
