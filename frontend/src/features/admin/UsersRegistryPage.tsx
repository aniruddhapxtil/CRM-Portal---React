import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { useToast } from "../../components/ui/Toast";
import { getUsersOverview } from "../../api/adminUsers";
import type { CrmUserOverviewRow } from "../../types/entities";

export function UsersRegistryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState<CrmUserOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUsersOverview()
      .then(setRows)
      .catch(() => toast.show("Failed to load users. Admin access is required for this page.", "danger"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: DataTableColumn<CrmUserOverviewRow>[] = [
    { key: "name", header: "Name", primary: true, render: (r) => <span className="font-semibold">{r.user_name}</span> },
    { key: "role", header: "Role", render: (r) => <Badge tone="brand">{r.role ?? "N/A"}</Badge> },
    { key: "email", header: "Email", render: (r) => r.email_id },
    { key: "designation", header: "Designation", render: (r) => r.designation },
    { key: "region", header: "Region", render: (r) => r.region },
    { key: "phone", header: "Phone", render: (r) => r.phone },
    {
      key: "can_sign_in",
      header: "Can sign in",
      render: (r) => <Badge tone={r.can_sign_in ? "success" : "neutral"}>{r.can_sign_in ? "Yes" : "No"}</Badge>,
    },
    { key: "created", header: "Created", render: (r) => r.creation_date },
    {
      key: "action",
      header: "Action",
      render: (r) => (
        <Button
          variant="outline"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/users/${r.id}/edit`);
          }}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Users"
        subtitle="People with sign-in access to the CRM."
        actions={<Button onClick={() => navigate("/admin/users/new")}>+ New User</Button>}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Search users…"
        filterRow={(r, q) =>
          r.user_name.toLowerCase().includes(q) ||
          r.email_id.toLowerCase().includes(q) ||
          (r.role ?? "").toLowerCase().includes(q)
        }
        emptyMessage={loading ? "Loading users…" : "No users yet."}
      />
    </AppLayout>
  );
}
