import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Card } from "../../components/ui/Card";
import { getOpportunitiesOverview } from "../../api/opportunities";
import { requestOpportunityQualification } from "../../api/qualifications";
import { SERVICE_LINE_OPTIONS, OPPORTUNITY_STAGE_WON, OPPORTUNITY_STAGE_LOST } from "../../constants/options";
import { serviceLineTone } from "../../constants/serviceLineColors";
import type { OpportunityOverviewRow } from "../../types/entities";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";

function probabilityTone(prob: number): "success" | "danger" | "warning" | "brand" {
  if (prob >= 100) return "success";
  if (prob <= 0) return "danger";
  if (prob >= 60) return "brand";
  return "warning";
}

export function OpportunityRegistryPage() {
  const navigate = useNavigate();
  const user = useAuth();
  const toast = useToast();
  const isSalesRep = user.role === "Sales Representative";
  const isReadOnly = user.role === "Executive";
  const canRequestProjectQualification = user.role === "Team Lead" || user.role === "Admin";
  const [rows, setRows] = useState<OpportunityOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceLineFilter, setServiceLineFilter] = useState("");
  const [selected, setSelected] = useState<OpportunityOverviewRow | null>(null);

  async function onRequestQualification(opportunityId: number) {
    try {
      await requestOpportunityQualification(opportunityId);
      toast.show("Qualification requested — sent to Admin for approval.", "success");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to request qualification.", "danger");
    }
  }

  useEffect(() => {
    getOpportunitiesOverview()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => (serviceLineFilter ? rows.filter((r) => r.service_line.includes(serviceLineFilter)) : rows),
    [rows, serviceLineFilter],
  );

  const columns: DataTableColumn<OpportunityOverviewRow>[] = [
    { key: "id", header: "Opp ID", render: (r) => <span className="font-mono text-xs text-muted">OPP-{r.id}</span> },
    { key: "opportunity_name", header: "Opportunity name", primary: true, render: (r) => <span className="font-semibold">{r.opportunity_name}</span> },
    { key: "account_name", header: "Account", render: (r) => r.account_name },
    { key: "contact_name", header: "Contact SPOC", render: (r) => r.contact_name },
    {
      key: "deal_size",
      header: "Deal size",
      render: (r) => (r.deal_size ? `${r.currency ?? "AED"} ${r.deal_size.toLocaleString()}` : "—"),
    },
    {
      key: "probability",
      header: "Probability",
      render: (r) => <Badge tone={probabilityTone(r.probability ?? 0)}>{r.probability ?? 0}%</Badge>,
    },
    {
      key: "service_line",
      header: "Service line",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.service_line.length === 0 ? "—" : r.service_line.map((s) => <Badge key={s} tone={serviceLineTone(s)}>{s}</Badge>)}
        </div>
      ),
    },
    { key: "next_steps", header: "Next steps", render: (r) => r.next_steps ?? "—" },
    { key: "next_action_date", header: "Next action date", render: (r) => r.next_action_date ?? "—" },
    {
      key: "action",
      header: "Action",
      render: (r) => (
        <div className="flex gap-2">
          <Button variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/opportunities/${r.id}/edit`); }}>
            {isReadOnly ? "View" : "Edit"}
          </Button>
          {canRequestProjectQualification && r.stage === OPPORTUNITY_STAGE_WON && (
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onRequestQualification(r.id);
              }}
            >
              Request Qualification
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Opportunities"
        subtitle="Commercial deals in active pipeline, tracked through to Closed Won or Closed Lost."
        actions={!isSalesRep && !isReadOnly && <Button onClick={() => navigate("/opportunities/new")}>+ New Opportunity</Button>}
      />

      <DataTable
        rows={filtered}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => setSelected((prev) => (prev?.id === r.id ? null : r))}
        searchPlaceholder="Search opportunities…"
        filterRow={(r, q) =>
          r.opportunity_name.toLowerCase().includes(q) ||
          r.account_name.toLowerCase().includes(q) ||
          r.contact_name.toLowerCase().includes(q)
        }
        emptyMessage={loading ? "Loading…" : "No opportunities yet."}
        toolbarExtra={
          <Select
            options={SERVICE_LINE_OPTIONS}
            placeholder="All Service Lines"
            value={serviceLineFilter}
            onChange={(e) => setServiceLineFilter(e.target.value)}
            className="max-w-xs"
          />
        }
      />

      {selected && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Stakeholder Handoff">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">Account</span><span className="font-semibold">{selected.account_name}</span></div>
              <div className="flex justify-between"><span className="text-muted">Account Manager</span><span>{selected.account_manager ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted">Contact</span><span className="font-semibold">{selected.contact_name}</span></div>
              {selected.lead_name && (
                <div className="flex justify-between"><span className="text-muted">Originating Lead</span><span>{selected.lead_name}</span></div>
              )}
              {selected.stage === OPPORTUNITY_STAGE_WON && (
                <Badge tone="warning">Closed Won — Project qualification may be pending</Badge>
              )}
            </div>
          </Card>

          <Card title="Service & Technology">
            <div className="flex flex-col gap-2 text-sm">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase text-muted">Service Line</div>
                <div className="flex flex-wrap gap-1">
                  {selected.service_line.length ? selected.service_line.map((s) => <Badge key={s} tone={serviceLineTone(s)}>{s}</Badge>) : "—"}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase text-muted">Technology</div>
                <div className="flex flex-wrap gap-1">
                  {selected.technology.length ? selected.technology.map((s) => <Badge key={s}>{s}</Badge>) : "—"}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Stage</span>
                <Badge tone={selected.stage === OPPORTUNITY_STAGE_LOST ? "danger" : "neutral"}>{selected.stage}</Badge>
              </div>
            </div>
          </Card>

          <Card
            title="Linked Activities"
            actions={
              !isReadOnly && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/activities/new?record_type=Opportunity&linked_record_id=${selected.id}`)}
                >
                  Log Activity
                </Button>
              )
            }
          >
            <div className="flex flex-col gap-2 text-sm">
              {selected.activities.length === 0 && <span className="text-muted">No activity logged yet.</span>}
              {selected.activities.map((a) => (
                <div key={a.id} className="flex justify-between border-b border-border/60 pb-1 last:border-0">
                  <span>{a.activity_name}</span>
                  <span className="text-xs text-muted">{a.activity_date}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
