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
import { StageTrack } from "../../components/ui/StageTrack";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { getOpportunity, saveOpportunity } from "../../api/opportunities";
import { requestOpportunityQualification } from "../../api/qualifications";
import { getLead } from "../../api/leads";
import { getLookups } from "../../api/lookups";
import {
  CURRENCY_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  SERVICE_LINE_OPTIONS,
  TECHNOLOGY_OPTIONS,
  OPPORTUNITY_TYPE_OPTIONS,
  FUNDED_BY_OPTIONS,
  SOURCE_OPTIONS,
  LOST_REASON_OPTIONS,
  OPPORTUNITY_STAGE_TRACK,
  OPPORTUNITY_STAGE_WON,
  OPPORTUNITY_STAGE_LOST,
  OPPORTUNITY_STAGE_PROBABILITY,
} from "../../constants/options";
import type { Opportunity, OpportunityFormIn, Lookups } from "../../types/entities";

const EMPTY: OpportunityFormIn = {
  lead_id: null,
  account_id: 0,
  subsidiary_id: null,
  contact_id: 0,
  opportunity_name: "",
  account_manager: "",
  deal_size: null,
  currency: "AED",
  project_type: "Fixed Cost",
  referred_by: "",
  service_line: [],
  technology: [],
  stage: OPPORTUNITY_STAGE_TRACK[0],
  probability: OPPORTUNITY_STAGE_PROBABILITY[OPPORTUNITY_STAGE_TRACK[0]],
  reason: null,
  opportunity_type: "New",
  funded_by: "Client",
  opportunity_source: "",
  next_steps: "",
  next_action_date: null,
  expected_closure_date: null,
  notes: "",
  attributes: [],
};

export function OpportunityFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const user = useAuth();
  const isReadOnly = user.role === "Executive";

  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [form, setForm] = useState<OpportunityFormIn>(EMPTY);
  const [meta, setMeta] = useState<{ recordId?: number }>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requestingQual, setRequestingQual] = useState(false);

  async function onRequestQualification() {
    if (!id) return;
    setRequestingQual(true);
    try {
      await requestOpportunityQualification(Number(id));
      toast.show("Qualification requested — sent to Admin for approval.", "success");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to request qualification.", "danger");
    } finally {
      setRequestingQual(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const lk = await getLookups();
      if (cancelled) return;
      setLookups(lk);

      if (isEdit && id) {
        const opp: Opportunity = await getOpportunity(Number(id));
        if (cancelled) return;
        setForm({ ...opp, opportunity_id: opp.id, probability: opp.probability ?? 0 });
        setMeta({ recordId: opp.id });
      } else {
        const leadId = Number(searchParams.get("lead_id")) || null;
        const accountId = Number(searchParams.get("account_id")) || 0;
        const contactId = Number(searchParams.get("contact_id")) || 0;

        // Pull the FULL lead record (not just the skinny /api/lookups entry) so converting a
        // Lead to an Opportunity carries over every field captured during the lead phase.
        const lead = leadId ? await getLead(leadId).catch(() => null) : null;
        if (cancelled) return;

        setForm((f) => ({
          ...f,
          lead_id: leadId,
          account_id: lead?.account_id ?? accountId,
          subsidiary_id: lead?.subsidiary_id ?? null,
          contact_id: lead?.contact_id ?? contactId,
          opportunity_name: lead?.lead_name ?? "",
          account_manager: lead?.account_manager ?? "",
          deal_size: lead?.deal_size ?? null,
          currency: lead?.currency ?? "AED",
          project_type: lead?.project_type ?? f.project_type,
          service_line: lead?.service_line ?? [],
          technology: lead?.technology ?? [],
          referred_by: lead?.referred_by ?? "",
          opportunity_source: lead?.lead_source && lead.lead_source !== "Campaign" ? lead.lead_source : "",
          next_steps: lead?.next_steps ?? "",
          next_action_date: lead?.next_action_date ?? null,
          notes: lead?.notes ?? "",
          attributes: lead?.attributes ?? [],
        }));
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
  const isLost = form.stage === OPPORTUNITY_STAGE_LOST;
  const isWon = form.stage === OPPORTUNITY_STAGE_WON;
  const reasonValid = !isLost || Boolean(form.reason);
  const canSave = accountValid && contactValid && form.opportunity_name.trim().length > 0 && reasonValid;

  function set<K extends keyof OpportunityFormIn>(key: K, value: OpportunityFormIn[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function changeStage(stage: string) {
    setForm((f) => ({ ...f, stage, probability: OPPORTUNITY_STAGE_PROBABILITY[stage] ?? f.probability, reason: null }));
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload: OpportunityFormIn = { ...form, opportunity_id: isEdit && id ? Number(id) : null };
      const res = await saveOpportunity(payload);
      toast.show(isEdit ? "Opportunity updated." : "Opportunity created.", "success");
      navigate(`/opportunities/${res.opportunity_id}/edit`, { replace: true });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to save opportunity.", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title={isEdit ? "Edit Opportunity" : "New Opportunity"} />
        <div className="p-12 text-center text-sm text-muted">Loading…</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={isEdit ? "Edit Opportunity" : "New Opportunity"}
        subtitle="Commercial deal tracked through the pipeline to Closed Won or Closed Lost."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/opportunities")}>Cancel</Button>
            <Button onClick={handleSave} disabled={!canSave || saving || isReadOnly}>
              {saving ? "Saving…" : isReadOnly ? "Read-only" : "Save Opportunity"}
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
                <div>
                  <FieldLabel>Expected Closure Date</FieldLabel>
                  <Input
                    type="date"
                    value={form.expected_closure_date ?? ""}
                    onChange={(e) => set("expected_closure_date", e.target.value)}
                  />
                </div>
              </div>
            </Card>
          )}

          <Card title="Pipeline Stage">
            <StageTrack
              stage={form.stage}
              onStageChange={changeStage}
              onMarkWon={() => setForm((f) => ({ ...f, stage: OPPORTUNITY_STAGE_WON, probability: 100, reason: null }))}
              onMarkLost={() => setForm((f) => ({ ...f, stage: OPPORTUNITY_STAGE_LOST, probability: 0 }))}
            />
            {isLost && (
              <div className="mt-4 rounded-lg border border-danger/30 bg-danger-light/40 p-3">
                <FieldLabel required error={!form.reason ? "A reason is required when marking Closed Lost." : undefined}>
                  Reason
                </FieldLabel>
                <Select
                  options={LOST_REASON_OPTIONS}
                  placeholder="Select a reason…"
                  value={form.reason ?? ""}
                  onChange={(e) => set("reason", e.target.value)}
                />
              </div>
            )}
            {isWon && (
              <div className="mt-4 rounded-lg border border-brand/30 bg-brand-tint/50 p-3 text-xs text-ink">
                A Team Lead can now request Project qualification from Admin — the delivery Project is created once approved.
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel required error={!accountValid ? "Account is required." : undefined}>Account</FieldLabel>
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
                <FieldLabel required>Opportunity Name</FieldLabel>
                <Input
                  value={form.opportunity_name}
                  onChange={(e) => set("opportunity_name", e.target.value)}
                  invalid={!form.opportunity_name.trim()}
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
                <FieldLabel>Service Line</FieldLabel>
                <MultiSelect options={SERVICE_LINE_OPTIONS} value={form.service_line} onChange={(v) => set("service_line", v)} />
              </div>

              <div>
                <FieldLabel>Opportunity Type</FieldLabel>
                <Select options={OPPORTUNITY_TYPE_OPTIONS} value={form.opportunity_type ?? ""} onChange={(e) => set("opportunity_type", e.target.value)} />
              </div>

              <div>
                <FieldLabel>Funded By</FieldLabel>
                <Select options={FUNDED_BY_OPTIONS} value={form.funded_by ?? ""} onChange={(e) => set("funded_by", e.target.value)} />
              </div>

              <div>
                <FieldLabel>Referred By</FieldLabel>
                <Input value={form.referred_by ?? ""} onChange={(e) => set("referred_by", e.target.value)} />
              </div>

              <div>
                <FieldLabel>Opportunity Source</FieldLabel>
                <Select options={SOURCE_OPTIONS.filter((s) => s !== "Campaign")} placeholder="Select source…" value={form.opportunity_source ?? ""} onChange={(e) => set("opportunity_source", e.target.value)} />
              </div>

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

                  <div>
                    <FieldLabel>Expected Closure Date</FieldLabel>
                    <Input
                      type="date"
                      value={form.expected_closure_date ?? ""}
                      onChange={(e) => set("expected_closure_date", e.target.value)}
                    />
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
          voiceExample="Move DIEZ Azure AI opportunity to proposal stage, 80 percent"
          recordId={meta.recordId ? `OPP-${meta.recordId}` : undefined}
          attributes={form.attributes}
          onAttributesChange={(v) => set("attributes", v)}
        >
          {isEdit && isWon && (user.role === "Team Lead" || user.role === "Admin") && (
            <Card title="Qualification">
              <Button className="w-full" onClick={onRequestQualification} disabled={requestingQual}>
                {requestingQual ? "Requesting…" : "Request Qualification"}
              </Button>
            </Card>
          )}
        </Sidebar>
      </div>
    </AppLayout>
  );
}
