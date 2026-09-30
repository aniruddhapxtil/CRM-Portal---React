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
import { getAccountsOverview } from "../../api/accounts";
import type { AccountOverviewRow } from "../../types/entities";

export function AccountsRegistryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const isReadOnly = useAuth().role === "Executive";
  const [rows, setRows] = useState<AccountOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    getAccountsOverview()
      .then(setRows)
      .catch(() => toast.show("Failed to load accounts.", "danger"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const columns: DataTableColumn<AccountOverviewRow>[] = [
    {
      key: "id",
      header: "Account ID",
      render: (r) => <Badge tone="brand">ACC-{String(r.id).padStart(3, "0")}</Badge>,
    },
    { key: "name", header: "Account name", primary: true, render: (r) => r.account_name },
    { key: "manager", header: "Account manager", render: (r) => r.account_manager ?? "Unassigned" },
    {
      key: "website",
      header: "Website",
      render: (r) =>
        r.website && r.website.startsWith("http") ? (
          <a href={r.website} target="_blank" rel="noreferrer" className="text-brand-cyan underline">
            {r.website}
          </a>
        ) : (
          r.website || "N/A"
        ),
    },
    { key: "region", header: "Region", render: (r) => r.region ?? "N/A" },
    { key: "industry", header: "Industry", render: (r) => r.industry ?? "N/A" },
    { key: "subs", header: "Subsidiaries", render: (r) => r.subsidiaries.length },
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
            navigate(`/accounts/${r.id}/edit`);
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
        title="Accounts"
        subtitle="Parent enterprise accounts — the top of the DataPhi CRM hierarchy."
        actions={!isReadOnly && <Button onClick={() => navigate("/accounts/new")}>+ New Account</Button>}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => setSelectedId(r.id === selectedId ? null : r.id)}
        searchPlaceholder="Search accounts…"
        filterRow={(r, q) =>
          r.account_name.toLowerCase().includes(q) ||
          (r.account_manager ?? "").toLowerCase().includes(q) ||
          (r.industry ?? "").toLowerCase().includes(q) ||
          (r.region ?? "").toLowerCase().includes(q)
        }
        emptyMessage={loading ? "Loading accounts…" : "No accounts yet."}
      />

      {selected && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card
            title={`Subsidiaries of ${selected.account_name}`}
            actions={
              !isReadOnly && (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `/subsidiaries/new?account_id=${selected.id}&account_name=${encodeURIComponent(selected.account_name)}`,
                    )
                  }
                >
                  + Add
                </Button>
              )
            }
          >
            {selected.subsidiaries.length === 0 ? (
              <p className="text-sm text-muted">No subsidiaries yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold uppercase text-muted">
                    <th className="py-1.5">ID</th>
                    <th className="py-1.5">Name</th>
                    <th className="py-1.5">Region</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.subsidiaries.map((s) => (
                    <tr key={s.id} className="border-t border-border/70">
                      <td className="py-1.5">SUB-{s.id}</td>
                      <td className="py-1.5">{s.subsidiary_name}</td>
                      <td className="py-1.5">{s.region}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card
            title={`Contacts of ${selected.account_name}`}
            actions={
              !isReadOnly && (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `/contacts/new?account_id=${selected.id}&account_name=${encodeURIComponent(selected.account_name)}`,
                    )
                  }
                >
                  + Add
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
