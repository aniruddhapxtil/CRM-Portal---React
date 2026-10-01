import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Card } from "../../components/ui/Card";
import { getLeadsOverview } from "../../api/leads";
import { requestLeadQualification } from "../../api/qualifications";
import { SERVICE_LINE_OPTIONS } from "../../constants/options";
import type { LeadOverviewRow } from "../../types/entities";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";

function classificationTone(type: string | null): "danger" | "warning" | "brand" | "neutral" {
  if (type === "Hot") return "danger";
  if (type === "Warm") return "warning";
  if (type === "Cold") return "brand";
  return "neutral";
}

export function LeadRegistryPage() {
  const navigate = useNavigate();
  const user = useAuth();
  const toast = useToast();
  const isSalesRep = user.role === "Sales Representative";
  const isReadOnly = user.role === "Executive";
  const [rows, setRows] = useState<LeadOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceLineFilter, setServiceLineFilter] = useState("");
  const [selected, setSelected] = useState<LeadOverviewRow | null>(null);

  async function onRequestQualification(leadId: number) {
    try {
      await requestLeadQualification(leadId);
      toast.show("Qualification requested — sent to Admin and Team Lead for approval.", "success");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to request qualification.", "danger");
    }
  }

  useEffect(() => {
    getLeadsOverview()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const filteredByServiceLine = useMemo(
    () => (serviceLineFilter ? rows.filter((r) => r.service_line.includes(serviceLineFilter)) : rows),
    [rows, serviceLineFilter],
  );

  const columns: DataTableColumn<LeadOverviewRow>[] = [
    { key: "id", header: "Lead ID", render: (r) => <span className="font-mono text-xs text-muted">LEAD-{r.id}</span> },
    { key: "lead_name", header: "Lead name", primary: true, render: (r) => <span className="font-semibold">{r.lead_name}</span> },
    { key: "account_name", header: "Account", render: (r) => r.account_name },
    { key: "contact_name", header: "Contact SPOC", render: (r) => r.contact_name },
    {
      key: "deal_size",
      header: "Deal size",
      render: (r) => (r.deal_size ? `${r.currency ?? "AED"} ${r.deal_size.toLocaleString()}` : "—"),
    },
    {
      key: "type",
      header: "Classification",
      render: (r) => <Badge tone={classificationTone(r.type)}>{r.type ?? "N/A"}</Badge>,
    },
    {
      key: "service_line",
      header: "Service line",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.service_line.length === 0 ? "—" : r.service_line.map((s) => <Badge key={s}>{s}</Badge>)}
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
          <Button variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/leads/${r.id}/edit`); }}>
            {isReadOnly ? "View" : "Edit"}
          </Button>
          {isSalesRep && (
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
        title="Leads"
        subtitle="Pre-opportunity commercial interest, qualified from stakeholder conversations."
        actions={!isReadOnly && <Button onClick={() => navigate("/leads/new")}>+ New Lead</Button>}
      />

      <DataTable
        rows={filteredByServiceLine}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => setSelected((prev) => (prev?.id === r.id ? null : r))}
        searchPlaceholder="Search leads…"
        filterRow={(r, q) =>
          r.lead_name.toLowerCase().includes(q) ||
          r.account_name.toLowerCase().includes(q) ||
          r.contact_name.toLowerCase().includes(q)
        }
        emptyMessage={loading ? "Loading…" : "No leads yet."}
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
              {!isSalesRep && !isReadOnly && (
                <Button
                  className="mt-2"
                  onClick={() =>
                    navigate(
                      `/opportunities/new?lead_id=${selected.id}&account_id=${selected.account_id}&contact_id=${selected.contact_id}`,
                    )
                  }
                >
                  Convert to Opportunity
                </Button>
              )}
            </div>
          </Card>

          <Card title="Service & Technology">
            <div className="flex flex-col gap-2 text-sm">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase text-muted">Service Line</div>
                <div className="flex flex-wrap gap-1">
                  {selected.service_line.length ? selected.service_line.map((s) => <Badge key={s} tone="brand">{s}</Badge>) : "—"}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase text-muted">Technology</div>
                <div className="flex flex-wrap gap-1">
                  {selected.technology.length ? selected.technology.map((s) => <Badge key={s}>{s}</Badge>) : "—"}
                </div>
              </div>
              <div className="flex justify-between"><span className="text-muted">Stage</span><span>{selected.stage}</span></div>
            </div>
          </Card>

          <Card
            title="Linked Activities"
            actions={
              !isReadOnly && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/activities/new?record_type=Lead&linked_record_id=${selected.id}`)}
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
