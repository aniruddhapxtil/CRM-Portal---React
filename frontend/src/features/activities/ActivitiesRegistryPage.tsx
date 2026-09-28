import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { useToast } from "../../components/ui/Toast";
import { getActivitiesOverview } from "../../api/activities";
import type { ActivityOverviewRow } from "../../types/entities";

const RECORD_TYPE_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  Account: "brand",
  Lead: "warning",
  Opportunity: "success",
  Project: "danger",
  Campaign: "neutral",
};

export function ActivitiesRegistryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState<ActivityOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActivitiesOverview()
      .then(setRows)
      .catch(() => toast.show("Failed to load activities.", "danger"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: DataTableColumn<ActivityOverviewRow>[] = [
    { key: "activity_name", header: "Activity Name", primary: true, render: (r) => <span className="font-semibold">{r.activity_name}</span> },
    {
      key: "record_type",
      header: "Record Type",
      render: (r) => <Badge tone={RECORD_TYPE_TONE[r.record_type] ?? "neutral"}>{r.record_type}</Badge>,
    },
    { key: "linked_label", header: "Linked Record", render: (r) => r.linked_label },
    { key: "record_action", header: "Action", render: (r) => r.record_action },
    { key: "activity_date", header: "Date", render: (r) => r.activity_date ?? "—" },
    {
      key: "edit",
      header: "Edit",
      render: (r) => (
        <Link to={`/activities/${r.id}/edit`} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold text-brand-cyan hover:underline">
          Edit
        </Link>
      ),
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        crumb="Activity"
        title="Activity"
        subtitle="Interaction timeline across every Account, Lead, Opportunity, Project, and Campaign."
        actions={<Button onClick={() => navigate("/activities/new")}>+ Log Activity</Button>}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Search activities…"
        filterRow={(r, q) =>
          r.activity_name.toLowerCase().includes(q) ||
          r.linked_label.toLowerCase().includes(q) ||
          r.record_type.toLowerCase().includes(q) ||
          r.record_action.toLowerCase().includes(q)
        }
        emptyMessage={loading ? "Loading…" : "No activity logged yet."}
      />
    </AppLayout>
  );
}
