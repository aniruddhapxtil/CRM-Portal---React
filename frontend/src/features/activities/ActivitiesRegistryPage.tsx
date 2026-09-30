import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { getActivitiesOverview } from "../../api/activities";
import type { ActivityOverviewRow } from "../../types/entities";

const RECORD_TYPE_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  Account: "brand",
  Subsidiary: "brand",
  Contact: "brand",
  Lead: "warning",
  Opportunity: "success",
  Project: "danger",
  Campaign: "neutral",
};

/** Route prefix for the form that owns each linked-record type, used to route a click on a
 * system-generated audit row straight to the record that actually changed. */
const RECORD_TYPE_ROUTE: Record<string, string> = {
  Account: "/accounts",
  Subsidiary: "/subsidiaries",
  Contact: "/contacts",
  Lead: "/leads",
  Opportunity: "/opportunities",
  Project: "/projects",
};

export function ActivitiesRegistryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const isReadOnly = useAuth().role === "Executive";
  const [rows, setRows] = useState<ActivityOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActivitiesOverview()
      .then(setRows)
      .catch(() => toast.show("Failed to load activities.", "danger"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function linkedRecordRoute(r: ActivityOverviewRow): string | null {
    const prefix = RECORD_TYPE_ROUTE[r.record_type];
    return prefix && r.linked_record_id ? `${prefix}/${r.linked_record_id}/edit` : null;
  }

  const columns: DataTableColumn<ActivityOverviewRow>[] = [
    {
      key: "activity_name",
      header: "Activity name",
      primary: true,
      render: (r) => (
        <span className={`font-semibold ${r.is_system ? "italic text-muted" : ""}`}>
          {r.is_system && "⚙ "}
          {r.activity_name}
        </span>
      ),
    },
    {
      key: "record_type",
      header: "Record type",
      render: (r) => <Badge tone={RECORD_TYPE_TONE[r.record_type] ?? "neutral"}>{r.record_type}</Badge>,
    },
    {
      key: "linked_label",
      header: "Linked record",
      render: (r) => {
        const route = linkedRecordRoute(r);
        return route ? (
          <Link to={route} onClick={(e) => e.stopPropagation()} className="font-semibold text-brand-cyan hover:underline">
            {r.linked_label}
          </Link>
        ) : (
          r.linked_label
        );
      },
    },
    { key: "record_action", header: "Action", render: (r) => r.record_action },
    { key: "activity_date", header: "Date", render: (r) => r.activity_date ?? "—" },
    {
      key: "edit",
      header: "Edit",
      render: (r) => {
        // System-generated rows have no Activity form of their own — route straight to the
        // record that actually changed instead of an Activity edit form for a non-editable log.
        const route = r.is_system ? linkedRecordRoute(r) : `/activities/${r.id}/edit`;
        if (!route) return null;
        return (
          <Link to={route} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold text-brand-cyan hover:underline">
            {r.is_system || isReadOnly ? "View" : "Edit"}
          </Link>
        );
      },
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Activity"
        subtitle="Interaction timeline across every Account, Lead, Opportunity, Project, and Campaign."
        actions={!isReadOnly && <Button onClick={() => navigate("/activities/new")}>+ Log Activity</Button>}
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
