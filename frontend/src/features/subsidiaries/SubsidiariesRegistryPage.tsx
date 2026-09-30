import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { getSubsidiariesOverview } from "../../api/subsidiaries";
import type { SubsidiaryOverviewRow } from "../../types/entities";

export function SubsidiariesRegistryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const isReadOnly = useAuth().role === "Executive";
  const [rows, setRows] = useState<SubsidiaryOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    getSubsidiariesOverview()
      .then(setRows)
      .catch(() => toast.show("Failed to load subsidiaries.", "danger"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const columns: DataTableColumn<SubsidiaryOverviewRow>[] = [
    { key: "id", header: "Subsidiary ID", render: (r) => <Badge tone="brand">SUB-{r.id}</Badge> },
    { key: "name", header: "Subsidiary name", primary: true, render: (r) => r.subsidiary_name },
    { key: "account", header: "Parent account", render: (r) => r.account_name },
    { key: "region", header: "Region", render: (r) => r.region ?? "N/A" },
    { key: "industry", header: "Industry", render: (r) => r.industry ?? "N/A" },
    { key: "contacts", header: "Contacts", render: (r) => r.contacts.length },
    {
      key: "action",
      header: "Action",
      render: (r) => (
        <Button
          variant="outline"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/subsidiaries/${r.id}/edit`);
          }}
        >
          {isReadOnly ? "View" : "Edit"}
        </Button>
      ),
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Subsidiaries"
        subtitle="Branches and divisions under parent accounts."
        actions={!isReadOnly && <Button onClick={() => navigate("/subsidiaries/new")}>+ New Subsidiary</Button>}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => setSelectedId(r.id === selectedId ? null : r.id)}
        searchPlaceholder="Search subsidiaries…"
        filterRow={(r, q) =>
          r.subsidiary_name.toLowerCase().includes(q) ||
          r.account_name.toLowerCase().includes(q) ||
          (r.region ?? "").toLowerCase().includes(q)
        }
        emptyMessage={loading ? "Loading subsidiaries…" : "No subsidiaries yet."}
      />

      {selected && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card
            title="Parent Account"
            actions={
              <Button variant="outline" onClick={() => navigate("/accounts")}>
                View All Accounts
              </Button>
            }
          >
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold text-muted">Account</span>
                <span className="text-ink">{selected.account_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted">Account ID</span>
                <span className="text-ink">ACC-{String(selected.account_id).padStart(3, "0")}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted">Account Manager</span>
                <span className="text-ink">{selected.account_manager}</span>
              </div>
            </div>
          </Card>

          <Card
            title={`Contacts of ${selected.subsidiary_name}`}
            actions={
              !isReadOnly && (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `/contacts/new?account_id=${selected.account_id}&subsidiary_id=${selected.id}&subsidiary_name=${encodeURIComponent(selected.subsidiary_name)}`,
                    )
                  }
                >
                  + Add Contact
                </Button>
              )
            }
          >
            {selected.contacts.length === 0 ? (
              <p className="text-sm text-muted">No contacts yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold uppercase text-muted">
                    <th className="py-1.5">Name</th>
                    <th className="py-1.5">Designation</th>
                    <th className="py-1.5">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.contacts.map((c) => (
                    <tr key={c.id} className="border-t border-border/70">
                      <td className="py-1.5">{c.contact_name}</td>
                      <td className="py-1.5">{c.designation}</td>
                      <td className="py-1.5">{c.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
