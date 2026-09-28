import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { useToast } from "../../components/ui/Toast";
import { getContactsOverview } from "../../api/contacts";
import type { ContactOverviewRow } from "../../types/entities";

export function ContactsRegistryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState<ContactOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    getContactsOverview()
      .then(setRows)
      .catch(() => toast.show("Failed to load contacts.", "danger"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const dealsForSelected = selected
    ? [
        ...selected.leads.map((l) => ({ ...l, kind: "Lead" as const, name: l.lead_name })),
        ...selected.opportunities.map((o) => ({ ...o, kind: "Opportunity" as const, name: o.opportunity_name })),
      ]
    : [];

  const columns: DataTableColumn<ContactOverviewRow>[] = [
    { key: "id", header: "Contact ID", render: (r) => <Badge tone="brand">CON-{r.id}</Badge> },
    { key: "name", header: "Contact Name", primary: true, render: (r) => r.contact_name },
    { key: "designation", header: "Designation", render: (r) => r.designation ?? "N/A" },
    { key: "department", header: "Department", render: (r) => r.department ?? "N/A" },
    { key: "email", header: "Email", render: (r) => r.email ?? "N/A" },
    { key: "account", header: "Parent Account", render: (r) => r.account_name },
    {
      key: "subsidiary",
      header: "Subsidiary",
      render: (r) => (r.subsidiary_name ? <Badge>{r.subsidiary_name}</Badge> : <Badge tone="neutral">Direct</Badge>),
    },
    {
      key: "action",
      header: "Action",
      render: (r) => (
        <Button
          variant="outline"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/contacts/${r.id}/edit`);
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
        crumb="Contacts"
        title="Contacts"
        subtitle="Client stakeholders across accounts and subsidiaries."
        actions={<Button onClick={() => navigate("/contacts/new")}>+ New Contact</Button>}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => setSelectedId(r.id === selectedId ? null : r.id)}
        searchPlaceholder="Search contacts…"
        filterRow={(r, q) =>
          r.contact_name.toLowerCase().includes(q) ||
          (r.designation ?? "").toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q) ||
          r.account_name.toLowerCase().includes(q)
        }
        emptyMessage={loading ? "Loading contacts…" : "No contacts yet."}
      />

      {selected && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Linked Enterprise & Branch">
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold text-muted">Account</span>
                <span className="text-ink">{selected.account_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted">Subsidiary</span>
                <span className="text-ink">{selected.subsidiary_name ?? "Direct"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted">Mobile</span>
                <span className="text-ink">
                  {selected.mobile_country_code} {selected.mobile}
                </span>
              </div>
            </div>
          </Card>

          <Card
            title="Associated Leads & Deals"
            actions={
              <Button
                variant="outline"
                onClick={() =>
                  navigate(`/leads/new?contact_id=${selected.id}&account_id=${selected.account_id}`)
                }
              >
                + Create Lead
              </Button>
            }
          >
            {dealsForSelected.length === 0 ? (
              <p className="text-sm text-muted">No leads or opportunities yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold uppercase text-muted">
                    <th className="py-1.5">Type</th>
                    <th className="py-1.5">Name</th>
                    <th className="py-1.5">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {dealsForSelected.map((d) => (
                    <tr key={`${d.kind}-${d.id}`} className="border-t border-border/70">
                      <td className="py-1.5">
                        <Badge tone={d.kind === "Lead" ? "warning" : "success"}>{d.kind}</Badge>
                      </td>
                      <td className="py-1.5">{d.name}</td>
                      <td className="py-1.5">{d.stage}</td>
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
