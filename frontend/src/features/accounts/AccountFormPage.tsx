import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Sidebar } from "../../components/layout/Sidebar";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { FieldLabel, Input, Textarea } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useToast } from "../../components/ui/Toast";
import { getAccount, saveAccount } from "../../api/accounts";
import { REGION_OPTIONS, INDUSTRY_OPTIONS } from "../../constants/options";
import type { AccountFormIn } from "../../types/entities";

const BLANK: AccountFormIn = {
  account_name: "",
  account_manager: "",
  region: "",
  industry: "",
  website: "",
  notes: "",
  attributes: [],
};

export function AccountFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState<AccountFormIn>(BLANK);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getAccount(Number(id))
      .then((acc) => {
        setForm({
          account_id: acc.id,
          account_name: acc.account_name,
          account_manager: acc.account_manager ?? "",
          region: acc.region ?? "",
          industry: acc.industry ?? "",
          website: acc.website ?? "",
          notes: acc.notes ?? "",
          attributes: acc.attributes,
        });
      })
      .catch(() => toast.show("Failed to load account.", "danger"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function set<K extends keyof AccountFormIn>(key: K, value: AccountFormIn[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const nameMissing = !form.account_name.trim();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nameMissing) return;
    setSaving(true);
    try {
      const res = await saveAccount(form);
      toast.show(isEdit ? "Account updated." : "Account created.", "success");
      navigate(`/accounts/${res.account_id}/edit`, { replace: true });
    } catch {
      toast.show("Failed to save account.", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <PageHeader crumb="Accounts" title="Loading…" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <form onSubmit={onSubmit}>
        <PageHeader
          crumb="Accounts"
          title={isEdit ? `Edit Account` : "New Account"}
          subtitle="Parent enterprise account — top of the DataPhi CRM hierarchy."
          actions={
            <>
              <Button type="button" variant="outline" onClick={() => navigate("/accounts")}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || nameMissing}>
                {saving ? "Saving…" : "Save Account"}
              </Button>
            </>
          }
        />

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1">
            <Card title="Account Details">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel
                    required
                    error={nameMissing ? "Company / account name is required." : undefined}
                    helper={!nameMissing ? "Parent enterprise account name." : undefined}
                  >
                    Account Name
                  </FieldLabel>
                  <Input
                    value={form.account_name}
                    onChange={(e) => set("account_name", e.target.value)}
                    placeholder="e.g. Dubai Integrated Economic Zones"
                    invalid={nameMissing}
                  />
                </div>

                <div>
                  <FieldLabel>Account Manager</FieldLabel>
                  <Input
                    value={form.account_manager ?? ""}
                    onChange={(e) => set("account_manager", e.target.value)}
                    placeholder="e.g. Ramanj Falasi"
                  />
                </div>

                <div>
                  <FieldLabel>Region</FieldLabel>
                  <Select
                    options={REGION_OPTIONS}
                    placeholder="Select region"
                    value={form.region ?? ""}
                    onChange={(e) => set("region", e.target.value)}
                  />
                </div>

                <div>
                  <FieldLabel>Industry</FieldLabel>
                  <Select
                    options={INDUSTRY_OPTIONS}
                    placeholder="Select industry"
                    value={form.industry ?? ""}
                    onChange={(e) => set("industry", e.target.value)}
                  />
                </div>

                <div>
                  <FieldLabel>Website</FieldLabel>
                  <Input
                    value={form.website ?? ""}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="https://…"
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Notes</FieldLabel>
                  <Textarea
                    rows={3}
                    value={form.notes ?? ""}
                    onChange={(e) => set("notes", e.target.value)}
                  />
                </div>
              </div>
            </Card>
          </div>

          <Sidebar
            voiceExample="Add account Dubai Integrated Economic Zones, region Dubai"
            recordId={isEdit ? `ACC-${id}` : undefined}
            createdBy="—"
            attributes={form.attributes}
            onAttributesChange={(v) => set("attributes", v)}
          />
        </div>
      </form>
    </AppLayout>
  );
}
