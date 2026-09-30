import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Sidebar } from "../../components/layout/Sidebar";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Textarea, FieldLabel } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { SearchableSelect, type SearchableOption } from "../../components/ui/SearchableSelect";
import { MultiSelect } from "../../components/ui/MultiSelect";
import { useToast } from "../../components/ui/Toast";
import { useNotifications } from "../../context/NotificationContext";
import { useAuth } from "../../context/AuthContext";
import { getLead, saveLead } from "../../api/leads";
import { requestLeadQualification } from "../../api/qualifications";
import { getAccount } from "../../api/accounts";
import { getContact } from "../../api/contacts";
import { getLookups } from "../../api/lookups";
import { isAccountIncomplete, isContactIncomplete } from "../../utils/completeness";
import {
  CURRENCY_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  SERVICE_LINE_OPTIONS,
  TECHNOLOGY_OPTIONS,
  LEAD_STAGE_OPTIONS,
  LEAD_TYPE_OPTIONS,
  DISQUALIFICATION_REASON_OPTIONS,
  SOURCE_OPTIONS,
} from "../../constants/options";
import type { Lead, LeadFormIn, Lookups } from "../../types/entities";

const EMPTY: LeadFormIn = {
  account_id: 0,
  subsidiary_id: null,
  contact_id: 0,
  lead_name: "",
  account_manager: "",
  deal_size: null,
  currency: "AED",
  project_type: "T&M",
  referred_by: "",
  service_line: [],
  stage: "Qualified",
  disqualification_reason: null,
  type: "Warm",
  lead_source: "",
  campaign_name: "",
  technology: [],
  next_steps: "",
  next_action_date: null,
  notes: "",
  attributes: [],
};

export function LeadFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { notify } = useNotifications();
  const user = useAuth();
  const isReadOnly = user.role === "Executive";
  const [requestingQual, setRequestingQual] = useState(false);

  async function onRequestQualification() {
    if (!id) return;
    setRequestingQual(true);
    try {
      await requestLeadQualification(Number(id));
      toast.show("Qualification requested — sent to Admin and Team Lead for approval.", "success");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to request qualification.", "danger");
    } finally {
      setRequestingQual(false);
    }
  }

  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [form, setForm] = useState<LeadFormIn>(EMPTY);
  const [meta, setMeta] = useState<{ recordId?: number }>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const lk = await getLookups();
      if (cancelled) return;
      setLookups(lk);

      if (isEdit && id) {
        const lead: Lead = await getLead(Number(id));
        if (cancelled) return;
        setForm({ ...lead, lead_id: lead.id });
        setMeta({ recordId: lead.id });
      } else {
        const accountId = Number(searchParams.get("account_id")) || 0;
        const contactId = Number(searchParams.get("contact_id")) || 0;
        setForm((f) => ({ ...f, account_id: accountId, contact_id: contactId }));
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // A new Lead is about to begin against an Account/Contact that was only partially
  // captured (e.g. quick-created inline from the Activity log) — surface a top-bar
  // reminder rather than silently letting the gaps go unnoticed.
  useEffect(() => {
    if (isEdit || !form.account_id || !form.contact_id) return;
    let cancelled = false;
    (async () => {
      try {
        const account = await getAccount(form.account_id);
        if (!cancelled && isAccountIncomplete(account)) {
          notify({
            id: `account-${account.id}`,
            message: `Details need to be filled for this account: "${account.account_name}"`,
            href: `/accounts/${account.id}/edit`,
          });
        }
      } catch {
        /* ignore — best-effort reminder */
      }
      try {
        const contact = await getContact(form.contact_id);
        if (!cancelled && isContactIncomplete(contact)) {
          notify({
            id: `contact-${contact.id}`,
            message: `Details need to be filled for this contact: "${contact.contact_name}"`,
            href: `/contacts/${contact.id}/edit`,
          });
        }
      } catch {
        /* ignore — best-effort reminder */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, form.account_id, form.contact_id, notify]);

  const accountOptions: SearchableOption[] = useMemo(
    () => (lookups?.accounts ?? []).map((a) => ({ value: a.id, label: a.account_name })),
    [lookups],
  );
  const subsidiaryOptions: SearchableOption[] = useMemo(
    () =>
      (lookups?.subsidiaries ?? [])
        .filter((s) => !form.account_id || s.account_id === form.account_id)
        .map((s) => ({ value: s.id, label: s.subsidiary_name })),
    [lookups, form.account_id],
  );
  const contactOptions: SearchableOption[] = useMemo(
    () =>
      (lookups?.contacts ?? [])
        .filter((c) => {
          if (form.subsidiary_id) return c.subsidiary_id === form.subsidiary_id;
          if (form.account_id) return c.account_id === form.account_id;
          return true;
        })
        .map((c) => ({ value: c.id, label: c.contact_name })),
    [lookups, form.account_id, form.subsidiary_id],
  );

  const accountValid = Boolean(form.account_id);
  const contactValid = Boolean(form.contact_id);
  const canSave = accountValid && contactValid && form.lead_name.trim().length > 0;

  function set<K extends keyof LeadFormIn>(key: K, value: LeadFormIn[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload: LeadFormIn = {
        ...form,
        lead_id: isEdit && id ? Number(id) : null,
        campaign_name: form.lead_source === "Campaign" ? form.campaign_name : null,
        disqualification_reason: form.stage === "Disqualified" ? form.disqualification_reason : null,
      };
      const res = await saveLead(payload);
      toast.show(isEdit ? "Lead updated." : "Lead created.", "success");
      navigate(`/leads/${res.lead_id}/edit`, { replace: true });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to save lead.", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title={isEdit ? "Edit Lead" : "New Lead"} />
        <div className="p-12 text-center text-sm text-muted">Loading…</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={isEdit ? "Edit Lead" : "New Lead"}
        subtitle="Pre-opportunity commercial interest captured from a stakeholder conversation."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/leads")}>Cancel</Button>
            <Button onClick={handleSave} disabled={!canSave || saving || isReadOnly}>
              {saving ? "Saving…" : isReadOnly ? "Read-only" : "Save Lead"}
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1">
          {isEdit && (
            <Card title="Follow-Up" className="mb-4 border-brand/30 bg-brand-tint/40">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel>Next Steps</FieldLabel>
                  <Input value={form.next_steps ?? ""} onChange={(e) => set("next_steps", e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Next Action Date</FieldLabel>
                  <Input type="date" value={form.next_action_date ?? ""} onChange={(e) => set("next_action_date", e.target.value)} />
                </div>
              </div>
            </Card>
          )}

          <Card>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel required error={!accountValid ? "Account is required." : undefined}>Account Name</FieldLabel>
                <SearchableSelect
                  options={accountOptions}
                  value={form.account_id || null}
                  onChange={(v) => {
                    set("account_id", Number(v) || 0);
                    set("subsidiary_id", null);
                    set("contact_id", 0);
                  }}
                  invalid={!accountValid}
                  placeholder="Search account…"
                />
              </div>

              <div>
                <FieldLabel>Subsidiary</FieldLabel>
                <SearchableSelect
                  options={subsidiaryOptions}
                  value={form.subsidiary_id ?? null}
                  onChange={(v) => {
                    set("subsidiary_id", v ? Number(v) : null);
                    set("contact_id", 0);
                  }}
                  disabled={!form.account_id}
                  placeholder="Search subsidiary…"
                />
              </div>

              <div>
                <FieldLabel required error={!contactValid ? "Contact is required." : undefined}>Contact</FieldLabel>
                <SearchableSelect
                  options={contactOptions}
                  value={form.contact_id || null}
                  onChange={(v) => set("contact_id", Number(v) || 0)}
                  disabled={!form.account_id}
                  invalid={!contactValid}
                  placeholder="Search contact…"
                />
              </div>

              <div className="md:col-span-2">
                <FieldLabel required>Lead Name</FieldLabel>
                <Input
                  value={form.lead_name}
                  onChange={(e) => set("lead_name", e.target.value)}
                  placeholder="e.g. IoT Telemetry Lakehouse and Analytical Platform"
                  invalid={!form.lead_name.trim()}
                />
              </div>

              <div>
                <FieldLabel>Account Manager</FieldLabel>
                <Input value={form.account_manager ?? ""} onChange={(e) => set("account_manager", e.target.value)} />
              </div>

              <div>
                <FieldLabel>Deal Size & Currency</FieldLabel>
                <div className="flex items-stretch gap-2">
                  <Input
                    type="number"
                    className="min-w-0 flex-1"
                    value={form.deal_size ?? ""}
                    onChange={(e) => set("deal_size", e.target.value ? Number(e.target.value) : null)}
                    placeholder="0.00"
                  />
                  <Select
                    options={CURRENCY_OPTIONS}
                    value={form.currency ?? "AED"}
                    onChange={(e) => set("currency", e.target.value)}
                    className="w-28 shrink-0"
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Project Type</FieldLabel>
                <Select options={PROJECT_TYPE_OPTIONS} value={form.project_type ?? ""} onChange={(e) => set("project_type", e.target.value)} />
              </div>

              <div>
                <FieldLabel>Referred By</FieldLabel>
                <Input value={form.referred_by ?? ""} onChange={(e) => set("referred_by", e.target.value)} />
              </div>

              <div>
                <FieldLabel>Service Line</FieldLabel>
                <MultiSelect options={SERVICE_LINE_OPTIONS} value={form.service_line} onChange={(v) => set("service_line", v)} />
              </div>

              <div>
                <FieldLabel>Lead Status</FieldLabel>
                <Select options={LEAD_STAGE_OPTIONS} value={form.stage ?? "Qualified"} onChange={(e) => set("stage", e.target.value)} />
              </div>

              <div>
                <FieldLabel>Lead Classification</FieldLabel>
                <Select options={LEAD_TYPE_OPTIONS} value={form.type ?? "Warm"} onChange={(e) => set("type", e.target.value)} />
              </div>

              {form.stage === "Disqualified" && (
                <div className="md:col-span-2 rounded-lg border border-danger/30 bg-danger-light/40 p-3">
                  <FieldLabel required>Disqualification Reason</FieldLabel>
                  <Select
                    options={DISQUALIFICATION_REASON_OPTIONS}
                    placeholder="Select a reason…"
                    value={form.disqualification_reason ?? ""}
                    onChange={(e) => set("disqualification_reason", e.target.value)}
                  />
                </div>
              )}

              <div>
                <FieldLabel>Lead Source</FieldLabel>
                <Select options={SOURCE_OPTIONS} placeholder="Select source…" value={form.lead_source ?? ""} onChange={(e) => set("lead_source", e.target.value)} />
              </div>

              {form.lead_source === "Campaign" && (
                <div>
                  <FieldLabel required>Campaign Name</FieldLabel>
                  <Input value={form.campaign_name ?? ""} onChange={(e) => set("campaign_name", e.target.value)} />
                </div>
              )}

              <div>
                <FieldLabel>Technology</FieldLabel>
                <MultiSelect options={TECHNOLOGY_OPTIONS} value={form.technology} onChange={(v) => set("technology", v)} />
              </div>

              {!isEdit && (
                <>
                  <div className="md:col-span-2">
                    <FieldLabel>Next Steps</FieldLabel>
                    <Input value={form.next_steps ?? ""} onChange={(e) => set("next_steps", e.target.value)} />
                  </div>

                  <div>
                    <FieldLabel>Next Action Date</FieldLabel>
                    <Input type="date" value={form.next_action_date ?? ""} onChange={(e) => set("next_action_date", e.target.value)} />
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <FieldLabel>Notes</FieldLabel>
                <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>
          </Card>
        </div>

        <Sidebar
          voiceExample="Add lead IoT Telemetry Lakehouse for DIEZ, hot lead, Azure Databricks"
          recordId={meta.recordId ? `LEAD-${meta.recordId}` : undefined}
          attributes={form.attributes}
          onAttributesChange={(v) => set("attributes", v)}
        >
          {isEdit && user.role === "Sales Representative" && (
            <Card title="Qualification">
              <Button className="w-full" onClick={onRequestQualification} disabled={requestingQual}>
                {requestingQual ? "Requesting…" : "Request for Qualification"}
              </Button>
            </Card>
          )}
        </Sidebar>
      </div>
    </AppLayout>
  );
}
