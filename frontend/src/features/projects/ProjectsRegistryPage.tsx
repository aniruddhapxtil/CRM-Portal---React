import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { getProjectsOverview } from "../../api/projects";
import type { ProjectOverviewRow } from "../../types/entities";

const PO_STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  Awaited: "warning",
  Received: "brand",
  Validated: "brand",
  Closed: "success",
  Cancelled: "danger",
};

function formatMoney(value: number | null, currency: string | null) {
  if (!value) return "—";
  return `${currency ?? "AED"} ${value.toLocaleString()}`;
}

export function ProjectsRegistryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const user = useAuth();
  const isAdmin = user.role === "Admin";
  const isReadOnly = user.role === "Executive";
  const [rows, setRows] = useState<ProjectOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    getProjectsOverview()
      .then(setRows)
      .catch(() => toast.show("Failed to load projects.", "danger"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expanded = rows.find((r) => r.id === expandedId) ?? null;

  const columns: DataTableColumn<ProjectOverviewRow>[] = [
    { key: "project_name", header: "Project name", primary: true, render: (r) => <span className="font-semibold">{r.project_name}</span> },
    { key: "account_name", header: "Account", render: (r) => r.account_name },
    { key: "opportunity_name", header: "Opportunity", render: (r) => r.opportunity_name },
    { key: "value", header: "Value", render: (r) => formatMoney(r.value, r.currency) },
    {
      key: "po_status",
      header: "PO status",
      render: (r) => <Badge tone={PO_STATUS_TONE[r.po_status] ?? "neutral"}>{r.po_status}</Badge>,
    },
    { key: "po_number", header: "PO number", render: (r) => r.po_number ?? "—" },
    {
      key: "action",
      header: "Action",
      render: (r) => (
        <Link to={`/projects/${r.id}/edit`} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold text-brand-cyan hover:underline">
          {isReadOnly ? "View" : "Edit"}
        </Link>
      ),
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Projects"
        subtitle="Delivery engagements and purchase-order tracking."
        actions={isAdmin && <Button onClick={() => navigate("/projects/new")}>+ New Project</Button>}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => setExpandedId((id) => (id === r.id ? null : r.id))}
        searchPlaceholder="Search projects…"
        filterRow={(r, q) =>
          r.project_name.toLowerCase().includes(q) ||
          r.account_name.toLowerCase().includes(q) ||
          r.opportunity_name.toLowerCase().includes(q) ||
          (r.po_number ?? "").toLowerCase().includes(q)
        }
        emptyMessage={loading ? "Loading…" : "No projects yet."}
      />

      {expanded && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Originating Opportunity">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Opportunity</span>
                <span className="font-semibold text-ink">{expanded.opportunity_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Account</span>
                <span className="text-ink">{expanded.account_name}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {expanded.technology.map((t) => (
                  <Badge key={t} tone="brand">
                    {t}
                  </Badge>
                ))}
              </div>
              <Link to={`/opportunities/${expanded.opportunity_id}/edit`} className="mt-2 text-sm font-semibold text-brand-cyan hover:underline">
                View Opportunity →
              </Link>
            </div>
          </Card>

          <Card
            title="Delivery & Purchase Order"
            actions={
              !isReadOnly && (
                <Link to={`/activities/new?record_type=Project&linked_record_id=${expanded.id}`}>
                  <Button variant="outline">Log Activity</Button>
                </Link>
              )
            }
          >
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">PO Status</span>
                <Badge tone={PO_STATUS_TONE[expanded.po_status] ?? "neutral"}>{expanded.po_status}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">PO Number</span>
                <span className="text-ink">{expanded.po_number ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Start Date</span>
                <span className="text-ink">{expanded.start_date ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Close Date</span>
                <span className="text-ink">{expanded.close_date ?? "—"}</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
