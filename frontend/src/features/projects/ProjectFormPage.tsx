import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Sidebar } from "../../components/layout/Sidebar";
import { Card } from "../../components/ui/Card";
import { FieldLabel, Input, Textarea } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { SearchableSelect, type SearchableOption } from "../../components/ui/SearchableSelect";
import { MultiSelect } from "../../components/ui/MultiSelect";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { getLookups } from "../../api/lookups";
import { getProject, saveProject } from "../../api/projects";
import type { Lookups, ProjectFormIn } from "../../types/entities";
import { CURRENCY_OPTIONS, PO_STATUS_OPTIONS, TECHNOLOGY_OPTIONS } from "../../constants/options";

const EMPTY_FORM: ProjectFormIn = {
  project_id: null,
  opportunity_id: 0,
  account_id: 0,
  subsidiary_id: null,
  contact_id: 0,
  project_name: "",
  technology: [],
  value: null,
  currency: "AED",
  start_date: null,
  close_date: null,
  po_status: "Awaited",
  po_number: null,
  po_reason: null,
  notes: null,
  attributes: [],
};

export function ProjectFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const isReadOnly = useAuth().role === "Executive";

  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [form, setForm] = useState<ProjectFormIn>(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    getLookups().then(setLookups).catch(() => toast.show("Failed to load lookups.", "danger"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEdit) {
      const opportunityId = searchParams.get("opportunity_id");
      if (opportunityId) setForm((f) => ({ ...f, opportunity_id: Number(opportunityId) }));
      return;
    }
    setLoading(true);
    getProject(Number(id))
      .then((p) =>
        setForm({
          project_id: p.id,
          opportunity_id: p.opportunity_id,
          account_id: p.account_id,
          subsidiary_id: p.subsidiary_id,
          contact_id: p.contact_id,
          project_name: p.project_name,
          technology: p.technology,
          value: p.value,
          currency: p.currency,
          start_date: p.start_date,
          close_date: p.close_date,
          po_status: p.po_status,
          po_number: p.po_number,
          po_reason: p.po_reason,
          notes: p.notes,
          attributes: p.attributes,
        }),
      )
      .catch(() => toast.show("Failed to load project.", "danger"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const opportunityOptions: SearchableOption[] = useMemo(
    () => (lookups?.opportunities ?? []).map((o) => ({ value: o.id, label: `${o.opportunity_name} (${o.account_name ?? "N/A"})` })),
    [lookups],
  );

  const contactOptions: SearchableOption[] = useMemo(() => {
    if (!lookups) return [];
    return lookups.contacts
      .filter((c) => (form.account_id ? c.account_id === form.account_id : true))
      .filter((c) => (form.subsidiary_id ? c.subsidiary_id === form.subsidiary_id : true))
      .map((c) => ({ value: c.id, label: `${c.contact_name}${c.designation ? " — " + c.designation : ""}` }));
  }, [lookups, form.account_id, form.subsidiary_id]);

  function onOpportunityChange(value: number | string | null) {
    const opp = lookups?.opportunities.find((o) => o.id === value);
    setForm((f) => ({
      ...f,
      opportunity_id: Number(value) || 0,
      account_id: opp?.account_id ?? f.account_id,
      subsidiary_id: opp?.subsidiary_id ?? f.subsidiary_id,
      contact_id: f.contact_id || opp?.contact_id || 0,
      project_name: f.project_name || opp?.opportunity_name || "",
      technology: f.technology.length ? f.technology : (opp?.technology ?? []),
      value: f.value ?? opp?.deal_size ?? null,
      currency: f.currency || opp?.currency || "AED",
    }));
  }

  const poStatusRequiresNumber = form.po_status !== "Awaited";
  const poStatusRequiresReason = form.po_status === "Cancelled" || form.po_status === "Closed";

  const missingOpportunity = !form.opportunity_id;
  const missingContact = !form.contact_id;
  const missingName = !form.project_name.trim();
  const missingPoNumber = poStatusRequiresNumber && !(form.po_number ?? "").trim();
  const missingPoReason = poStatusRequiresReason && !(form.po_reason ?? "").trim();
  const canSave = !missingOpportunity && !missingContact && !missingName && !missingPoNumber && !missingPoReason;

  async function onSave() {
    setTouched(true);
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await saveProject(form);
      toast.show(isEdit ? "Project updated." : "Project created.", "success");
      navigate(`/projects/${res.project_id}/edit`, { replace: true });
    } catch {
      toast.show("Failed to save project.", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Loading…" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={isEdit ? "Edit Project" : "New Project"}
        subtitle="Delivery engagement, typically created automatically when an Opportunity is marked Closed Won."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/projects")}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving || isReadOnly}>
              {saving ? "Saving…" : isReadOnly ? "Read-only" : "Save Project"}
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1">
          <Card title="Delivery Engagement">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel required error={touched && missingOpportunity ? "Select the originating opportunity." : undefined}>
                  Originating Opportunity
                </FieldLabel>
                <SearchableSelect
                  options={opportunityOptions}
                  value={form.opportunity_id || null}
                  onChange={onOpportunityChange}
                  invalid={touched && missingOpportunity}
                  placeholder="Search opportunities…"
                />
              </div>

              <div>
                <FieldLabel required error={touched && missingContact ? "Select a contact." : undefined}>
                  Contact
                </FieldLabel>
                <SearchableSelect
                  options={contactOptions}
                  value={form.contact_id || null}
                  onChange={(v) => setForm((f) => ({ ...f, contact_id: Number(v) || 0 }))}
                  invalid={touched && missingContact}
                  disabled={!form.opportunity_id}
                  placeholder="Search contacts…"
                />
              </div>

              <div>
                <FieldLabel required error={touched && missingName ? "Project name is required." : undefined}>
                  Project Name
                </FieldLabel>
                <Input
                  value={form.project_name}
                  onChange={(e) => setForm((f) => ({ ...f, project_name: e.target.value }))}
                  invalid={touched && missingName}
                  placeholder="e.g. Azure Ai — Delivery"
                />
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Technology</FieldLabel>
                <MultiSelect
                  options={TECHNOLOGY_OPTIONS}
                  value={form.technology}
                  onChange={(v) => setForm((f) => ({ ...f, technology: v }))}
                  placeholder="Select technology…"
                />
              </div>

              <div>
                <FieldLabel>Value</FieldLabel>
                <div className="flex items-stretch gap-2">
                  <Input
                    type="number"
                    className="min-w-0 flex-1"
                    value={form.value ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="0.00"
                  />
                  <Select
                    options={CURRENCY_OPTIONS}
                    value={form.currency ?? "AED"}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className="w-28 shrink-0"
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Start Date</FieldLabel>
                <Input
                  type="date"
                  value={form.start_date ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value || null }))}
                />
              </div>
              <div>
                <FieldLabel>Close Date</FieldLabel>
                <Input
                  type="date"
                  value={form.close_date ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, close_date: e.target.value || null }))}
                />
              </div>
            </div>

            <hr className="my-5 border-border" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>PO Status</FieldLabel>
                <Select
                  options={PO_STATUS_OPTIONS}
                  value={form.po_status ?? "Awaited"}
                  onChange={(e) => setForm((f) => ({ ...f, po_status: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel
                  required={poStatusRequiresNumber}
                  error={touched && missingPoNumber ? "PO number is required once status leaves Awaited." : undefined}
                >
                  PO Number
                </FieldLabel>
                <Input
                  value={form.po_number ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, po_number: e.target.value }))}
                  invalid={touched && missingPoNumber}
                />
              </div>

              {poStatusRequiresReason && (
                <div className="md:col-span-2">
                  <FieldLabel required error={touched && missingPoReason ? "Reason is required for Cancelled/Closed POs." : undefined}>
                    PO Reason
                  </FieldLabel>
                  <Textarea
                    rows={2}
                    value={form.po_reason ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, po_reason: e.target.value }))}
                    invalid={touched && missingPoReason}
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <FieldLabel>Notes</FieldLabel>
                <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </Card>
        </div>

        <Sidebar
          voiceExample="Update the DIEZ delivery project PO number to PO-4521"
          recordId={form.project_id ?? undefined}
          attributes={form.attributes}
          onAttributesChange={(attributes) => setForm((f) => ({ ...f, attributes }))}
        />
      </div>
    </AppLayout>
  );
}
