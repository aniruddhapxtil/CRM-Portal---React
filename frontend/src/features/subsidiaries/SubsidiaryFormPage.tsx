import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Sidebar } from "../../components/layout/Sidebar";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { FieldLabel, Input, Textarea } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { SearchableSelect, type SearchableOption } from "../../components/ui/SearchableSelect";
import { useToast } from "../../components/ui/Toast";
import { getSubsidiary, saveSubsidiary } from "../../api/subsidiaries";
import { getLookups } from "../../api/lookups";
import { REGION_OPTIONS, INDUSTRY_OPTIONS } from "../../constants/options";
import type { Lookups, SubsidiaryFormIn } from "../../types/entities";

const BLANK: SubsidiaryFormIn = {
  account_id: 0,
  subsidiary_name: "",
  region: "",
  industry: "",
  notes: "",
  attributes: [],
};

export function SubsidiaryFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState<SubsidiaryFormIn>(BLANK);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLookups()
      .then((l) => !cancelled && setLookups(l))
      .catch(() => toast.show("Failed to load account list.", "danger"));

    if (id) {
      getSubsidiary(Number(id))
        .then((sub) => {
          if (cancelled) return;
          setForm({
            subsidiary_id: sub.id,
            account_id: sub.account_id,
            subsidiary_name: sub.subsidiary_name,
            region: sub.region ?? "",
            industry: sub.industry ?? "",
            notes: sub.notes ?? "",
            attributes: sub.attributes,
          });
        })
        .catch(() => toast.show("Failed to load subsidiary.", "danger"))
        .finally(() => !cancelled && setLoading(false));
    } else {
      const prefillAccountId = searchParams.get("account_id");
      if (prefillAccountId) {
        setForm((f) => ({ ...f, account_id: Number(prefillAccountId) }));
      }
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function set<K extends keyof SubsidiaryFormIn>(key: K, value: SubsidiaryFormIn[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const accountOptions: SearchableOption[] =
    lookups?.accounts.map((a) => ({ value: a.id, label: a.account_name })) ?? [];

  const nameMissing = !form.subsidiary_name.trim();
  const accountMissing = !form.account_id;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nameMissing || accountMissing) return;
    setSaving(true);
    try {
      const res = await saveSubsidiary(form);
      toast.show(isEdit ? "Subsidiary updated." : "Subsidiary created.", "success");
      navigate(`/subsidiaries/${res.subsidiary_id}/edit`, { replace: true });
    } catch {
      toast.show("Failed to save subsidiary.", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <PageHeader crumb="Subsidiaries" title="Loading…" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <form onSubmit={onSubmit}>
        <PageHeader
          crumb="Subsidiaries"
          title={isEdit ? "Edit Subsidiary" : "New Subsidiary"}
          subtitle="Branch or division under a parent account."
          actions={
            <>
              <Button type="button" variant="outline" onClick={() => navigate("/subsidiaries")}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || nameMissing || accountMissing}>
                {saving ? "Saving…" : "Save Subsidiary"}
              </Button>
            </>
          }
        />

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1">
            <Card title="Subsidiary Details">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel required error={accountMissing ? "Parent account is required." : undefined}>
                    Account
                  </FieldLabel>
                  <SearchableSelect
                    options={accountOptions}
                    value={form.account_id || null}
                    onChange={(v) => set("account_id", Number(v) || 0)}
                    placeholder="Search accounts…"
                    invalid={accountMissing}
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel required error={nameMissing ? "Subsidiary name is required." : undefined}>
                    Subsidiary Name
                  </FieldLabel>
                  <Input
                    value={form.subsidiary_name}
                    onChange={(e) => set("subsidiary_name", e.target.value)}
                    invalid={nameMissing}
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

                <div className="md:col-span-2">
                  <FieldLabel>Notes</FieldLabel>
                  <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
                </div>
              </div>
            </Card>
          </div>

          <Sidebar
            voiceExample="Add subsidiary Al Futtaim Retail under DIEZ"
            recordId={isEdit ? `SUB-${id}` : undefined}
            createdBy="—"
            attributes={form.attributes}
            onAttributesChange={(v) => set("attributes", v)}
          />
        </div>
      </form>
    </AppLayout>
  );
}
