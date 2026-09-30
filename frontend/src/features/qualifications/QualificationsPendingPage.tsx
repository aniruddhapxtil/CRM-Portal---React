import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { getQualificationsOverview, approveQualification, revokeQualification } from "../../api/qualifications";
import type { QualificationRequestRow } from "../../types/entities";

const TYPE_LABEL: Record<QualificationRequestRow["request_type"], string> = {
  lead_qualification: "Lead → Opportunity",
  opportunity_qualification: "Opportunity → Project",
};

const STATUS_TONE: Record<QualificationRequestRow["status"], "warning" | "success" | "danger"> = {
  Pending: "warning",
  Approved: "success",
  Revoked: "danger",
};

export function QualificationsPendingPage() {
  const user = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState<QualificationRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  function refresh() {
    setLoading(true);
    getQualificationsOverview()
      .then(setRows)
      .catch(() => toast.show("Failed to load qualification requests.", "danger"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onApprove(row: QualificationRequestRow) {
    setBusyId(row.id);
    try {
      await approveQualification(row.id);
      toast.show(
        row.request_type === "lead_qualification" ? "Approved — Opportunity created." : "Approved — Project created.",
        "success",
      );
      refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to approve request.", "danger");
    } finally {
      setBusyId(null);
    }
  }

  async function onRevoke(row: QualificationRequestRow) {
    setBusyId(row.id);
    try {
      await revokeQualification(row.id);
      toast.show("Request revoked.", "success");
      refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to revoke request.", "danger");
    } finally {
      setBusyId(null);
    }
  }

  const columns: DataTableColumn<QualificationRequestRow>[] = [
    { key: "type", header: "Type", primary: true, render: (r) => TYPE_LABEL[r.request_type] },
    {
      key: "record",
      header: "Record",
      render: (r) => (
        <button
          type="button"
          className="font-semibold text-brand hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate(r.request_type === "lead_qualification" ? `/leads/${r.lead_id}/edit` : `/opportunities/${r.opportunity_id}/edit`);
          }}
        >
          {r.linked_label ?? "N/A"}
        </button>
      ),
    },
    { key: "requested_by", header: "Requested by", render: (r) => r.requested_by_name ?? "N/A" },
    { key: "requested_at", header: "Requested at", render: (r) => (r.requested_at ? new Date(r.requested_at).toLocaleString() : "N/A") },
    { key: "status", header: "Status", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    {
      key: "action",
      header: "Action",
      render: (r) => {
        if (r.status !== "Pending") return null;
        if (!r.can_approve) {
          return <span className="text-xs italic text-muted">Awaiting Admin</span>;
        }
        return (
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onApprove(r);
              }}
              disabled={busyId === r.id}
            >
              Approve
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onRevoke(r);
              }}
              disabled={busyId === r.id}
            >
              Revoke
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Qualifications Pending"
        subtitle={
          user.role === "Admin"
            ? "Approve Lead → Opportunity and Opportunity → Project requests."
            : "Approve Lead → Opportunity requests. Opportunity → Project requests need Admin approval."
        }
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Search requests…"
        filterRow={(r, q) => (r.linked_label ?? "").toLowerCase().includes(q) || (r.requested_by_name ?? "").toLowerCase().includes(q)}
        emptyMessage={loading ? "Loading…" : "No qualification requests yet."}
      />
    </AppLayout>
  );
}
