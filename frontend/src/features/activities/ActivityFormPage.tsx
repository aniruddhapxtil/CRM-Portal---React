import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Sidebar } from "../../components/layout/Sidebar";
import { Card } from "../../components/ui/Card";
import { FieldLabel, Input, Textarea } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ChipRow } from "../../components/ui/ChipRow";
import { SearchableSelect, type SearchableOption } from "../../components/ui/SearchableSelect";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import { useNotifications } from "../../context/NotificationContext";
import { getLookups } from "../../api/lookups";
import { getActivity, saveActivity } from "../../api/activities";
import { saveAccount } from "../../api/accounts";
import { saveContact } from "../../api/contacts";
import type { ActivityFormIn, Lookups } from "../../types/entities";
import { ACTIVITY_RECORD_ACTION_OPTIONS, ACTIVITY_RECORD_TYPE_OPTIONS, INDUSTRY_OPTIONS } from "../../constants/options";

function nowLocalDatetime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Backend returns "YYYY-MM-DD HH:MM" (space-separated); <input type="datetime-local"> needs a "T". */
function toDatetimeLocalValue(value: string | null): string {
  if (!value) return nowLocalDatetime();
  return value.slice(0, 16).replace(" ", "T");
}

function emptyForm(): ActivityFormIn {
  return {
    activity_id: null,
    activity_name: "",
    record_type: "Account",
    linked_record_id: 0,
    contact_id: null,
    record_action: "Email",
    activity_date: nowLocalDatetime(),
    next_step: null,
    next_action_date: null,
    notes: null,
    attributes: [],
  };
}

interface QuickCreateState {
  accountName: string;
  industry: string;
  contactName: string;
  email: string;
  mobile: string;
}

function emptyQuickCreate(accountName = ""): QuickCreateState {
  return { accountName, industry: "", contactName: "", email: "", mobile: "" };
}

interface ContactQuickCreateState {
  contactName: string;
  email: string;
  mobile: string;
}

function emptyContactQuickCreate(contactName = ""): ContactQuickCreateState {
  return { contactName, email: "", mobile: "" };
}

export function ActivityFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { notify } = useNotifications();

  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [form, setForm] = useState<ActivityFormIn>(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreate, setQuickCreate] = useState<QuickCreateState>(emptyQuickCreate());
  const [quickCreateSaving, setQuickCreateSaving] = useState(false);

  const [contactQuickCreateOpen, setContactQuickCreateOpen] = useState(false);
  const [contactQuickCreate, setContactQuickCreate] = useState<ContactQuickCreateState>(emptyContactQuickCreate());
  const [contactQuickCreateSaving, setContactQuickCreateSaving] = useState(false);

  useEffect(() => {
    getLookups().then(setLookups).catch(() => toast.show("Failed to load lookups.", "danger"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEdit) {
      const recordType = searchParams.get("record_type");
      const linkedId = searchParams.get("linked_record_id");
      if (recordType || linkedId) {
        setForm((f) => ({
          ...f,
          record_type: recordType ?? f.record_type,
          linked_record_id: linkedId ? Number(linkedId) : f.linked_record_id,
        }));
      }
      return;
    }
    setLoading(true);
    getActivity(Number(id))
      .then((a) =>
        setForm({
          activity_id: a.id,
          activity_name: a.activity_name,
          record_type: a.record_type,
          linked_record_id: a.linked_record_id ?? 0,
          contact_id: a.contact_id ?? null,
          record_action: a.record_action,
          activity_date: toDatetimeLocalValue(a.activity_date),
          next_step: a.next_step,
          next_action_date: a.next_action_date,
          notes: a.notes,
          attributes: a.attributes,
        }),
      )
      .catch(() => toast.show("Failed to load activity.", "danger"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isCampaign = form.record_type === "Campaign";
  const isAccount = form.record_type === "Account";

  const linkedRecordOptions: SearchableOption[] = useMemo(() => {
    if (!lookups) return [];
    switch (form.record_type) {
      case "Account":
        return lookups.accounts.map((a) => ({ value: a.id, label: a.account_name }));
      case "Lead":
        return lookups.leads.map((l) => ({ value: l.id, label: `${l.lead_name} (${l.account_name ?? "N/A"})` }));
      case "Opportunity":
        return lookups.opportunities.map((o) => ({ value: o.id, label: `${o.opportunity_name} (${o.account_name ?? "N/A"})` }));
      case "Project":
        return lookups.projects.map((p) => ({ value: p.id, label: `${p.project_name} (${p.account_name ?? "N/A"})` }));
      default:
        return [];
    }
  }, [lookups, form.record_type]);

  const accountContactOptions: SearchableOption[] = useMemo(() => {
    if (!lookups || !form.linked_record_id) return [];
    return lookups.contacts
      .filter((c) => c.account_id === form.linked_record_id)
      .map((c) => ({ value: c.id, label: c.contact_name }));
  }, [lookups, form.linked_record_id]);

  function onRecordTypeChange(recordType: string) {
    setForm((f) => ({ ...f, record_type: recordType, linked_record_id: 0, contact_id: null }));
    setQuickCreateOpen(false);
    setContactQuickCreateOpen(false);
  }

  function openQuickCreate(typedName: string) {
    setQuickCreate(emptyQuickCreate(typedName));
    setQuickCreateOpen(true);
  }

  function openContactQuickCreate(typedName: string) {
    setContactQuickCreate(emptyContactQuickCreate(typedName));
    setContactQuickCreateOpen(true);
  }

  async function submitContactQuickCreate() {
    const contactName = contactQuickCreate.contactName.trim();
    if (!contactName || !form.linked_record_id) {
      toast.show("Contact name is required.", "danger");
      return;
    }
    setContactQuickCreateSaving(true);
    try {
      const contactRes = await saveContact({
        contact_id: null,
        account_id: form.linked_record_id,
        contact_name: contactName,
        email: contactQuickCreate.email || null,
        mobile: contactQuickCreate.mobile || null,
        attributes: [],
      });

      const freshLookups = await getLookups();
      setLookups(freshLookups);
      setForm((f) => ({ ...f, contact_id: contactRes.contact_id }));
      setContactQuickCreateOpen(false);
      toast.show(`Created contact "${contactName}".`, "success");

      notify({
        id: `contact-${contactRes.contact_id}`,
        message: `Details need to be filled for this contact: "${contactName}"`,
        href: `/contacts/${contactRes.contact_id}/edit`,
      });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Quick-create failed.", "danger");
    } finally {
      setContactQuickCreateSaving(false);
    }
  }

  async function submitQuickCreate() {
    const accountName = quickCreate.accountName.trim();
    const contactName = quickCreate.contactName.trim();
    if (!accountName || !contactName) {
      toast.show("Account name and contact name are required.", "danger");
      return;
    }
    setQuickCreateSaving(true);
    try {
      const accountRes = await saveAccount({
        account_id: null,
        account_name: accountName,
        industry: quickCreate.industry || null,
        attributes: [],
      });
      const contactRes = await saveContact({
        contact_id: null,
        account_id: accountRes.account_id,
        contact_name: contactName,
        email: quickCreate.email || null,
        mobile: quickCreate.mobile || null,
        attributes: [],
      });

      // Refresh lookups so the freshly-created account/contact appear in the SearchableSelects immediately.
      const freshLookups = await getLookups();
      setLookups(freshLookups);
      setForm((f) => ({ ...f, linked_record_id: accountRes.account_id, contact_id: contactRes.contact_id }));
      setQuickCreateOpen(false);
      toast.show(`Created account "${accountName}" and contact "${contactName}".`, "success");

      // These records were captured with only the bare minimum — surface a top-bar reminder
      // so the gaps (region, designation, etc.) don't get forgotten once the lead conversation starts.
      notify({
        id: `account-${accountRes.account_id}`,
        message: `Details need to be filled for this account: "${accountName}"`,
        href: `/accounts/${accountRes.account_id}/edit`,
      });
      notify({
        id: `contact-${contactRes.contact_id}`,
        message: `Details need to be filled for this contact: "${contactName}"`,
        href: `/contacts/${contactRes.contact_id}/edit`,
      });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Quick-create failed.", "danger");
    } finally {
      setQuickCreateSaving(false);
    }
  }

  const missingLinked = !isCampaign && !form.linked_record_id;
  const missingName = !form.activity_name.trim();
  const missingCampaignCount = isCampaign && !(form.attributes[0] ?? "").trim();
  const canSave = !missingLinked && !missingName && !missingCampaignCount;

  async function onSave() {
    setTouched(true);
    if (!canSave) return;
    setSaving(true);
    try {
      const payload: ActivityFormIn = { ...form, linked_record_id: isCampaign ? 0 : form.linked_record_id };
      const res = await saveActivity(payload);
      toast.show(isEdit ? "Activity updated." : "Activity logged.", "success");
      navigate(`/activities/${res.activity_id}/edit`, { replace: true });
    } catch {
      toast.show("Failed to save activity.", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <PageHeader crumb="Activity" title="Loading…" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        crumb="Activity"
        title={isEdit ? "Edit Activity" : "Log Activity"}
        subtitle="Record an interaction against an Account, Lead, Opportunity, Project, or Campaign."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/activities")}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save Activity"}
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1">
          <Card title="Activity Details">
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel required>Record Type</FieldLabel>
                <ChipRow options={ACTIVITY_RECORD_TYPE_OPTIONS} value={form.record_type} onChange={onRecordTypeChange} />
              </div>

              {isCampaign ? (
                <div>
                  <FieldLabel
                    required
                    error={touched && missingCampaignCount ? "Enter how many accounts this campaign was hosted for." : undefined}
                    helper="Stored against this campaign activity for reporting."
                  >
                    Number of Accounts Hosted
                  </FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    value={form.attributes[0] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, attributes: [e.target.value, ...f.attributes.slice(1)] }))}
                    invalid={touched && missingCampaignCount}
                    placeholder="e.g. 25"
                  />
                </div>
              ) : (
                <div>
                  <FieldLabel required error={touched && missingLinked ? "Select the linked record." : undefined}>
                    {isAccount ? "Account Name" : "Linked Record"}
                  </FieldLabel>
                  <SearchableSelect
                    options={linkedRecordOptions}
                    value={form.linked_record_id || null}
                    onChange={(v) => setForm((f) => ({ ...f, linked_record_id: Number(v) || 0, contact_id: null }))}
                    invalid={touched && missingLinked}
                    placeholder={isAccount ? "Search or type a new account name…" : "Search records…"}
                    onCreateNew={isAccount ? openQuickCreate : undefined}
                    createNewLabel={(q) => `+ Create account "${q}" & new contact`}
                  />
                </div>
              )}

              {isAccount && form.linked_record_id > 0 && (
                <div>
                  <FieldLabel helper="Optional — tag which stakeholder at this account this activity is about. If they're new, create them here.">
                    Contact Name
                  </FieldLabel>
                  <SearchableSelect
                    options={accountContactOptions}
                    value={form.contact_id ?? null}
                    onChange={(v) => setForm((f) => ({ ...f, contact_id: v ? Number(v) : null }))}
                    placeholder="Search or type a new contact name…"
                    onCreateNew={openContactQuickCreate}
                    createNewLabel={(q) => `+ Create contact "${q}"`}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel required error={touched && missingName ? "Activity name is required." : undefined}>
                    Activity Name
                  </FieldLabel>
                  <Input
                    value={form.activity_name}
                    onChange={(e) => setForm((f) => ({ ...f, activity_name: e.target.value }))}
                    invalid={touched && missingName}
                    placeholder="e.g. Discovery call with client"
                  />
                </div>
                <div>
                  <FieldLabel>Activity Date</FieldLabel>
                  <Input
                    type="datetime-local"
                    value={form.activity_date ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, activity_date: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Record Action</FieldLabel>
                <ChipRow
                  options={ACTIVITY_RECORD_ACTION_OPTIONS}
                  value={form.record_action}
                  onChange={(v) => setForm((f) => ({ ...f, record_action: v }))}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>Next Step</FieldLabel>
                  <Input value={form.next_step ?? ""} onChange={(e) => setForm((f) => ({ ...f, next_step: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>Next Action Date</FieldLabel>
                  <Input
                    type="date"
                    value={form.next_action_date ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, next_action_date: e.target.value || null }))}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Notes</FieldLabel>
                <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </Card>
        </div>

        <Sidebar
          voiceExample="Logged a call with Tariq Mansoor, interested in the proposal"
          recordId={form.activity_id ?? undefined}
          attributes={form.attributes}
          onAttributesChange={(attributes) => setForm((f) => ({ ...f, attributes }))}
        />
      </div>

      <Modal
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        title="Create Account & Contact"
        footer={
          <>
            <Button variant="outline" onClick={() => setQuickCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitQuickCreate} disabled={quickCreateSaving}>
              {quickCreateSaving ? "Creating…" : "Create"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted">
            No matching account was found. Capture the essentials now — you can fill in the rest later (you'll get a reminder).
          </p>
          <div>
            <FieldLabel required>Account Name</FieldLabel>
            <Input
              value={quickCreate.accountName}
              onChange={(e) => setQuickCreate((q) => ({ ...q, accountName: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel>Industry</FieldLabel>
            <Select
              options={INDUSTRY_OPTIONS}
              placeholder="Select industry…"
              value={quickCreate.industry}
              onChange={(e) => setQuickCreate((q) => ({ ...q, industry: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel required>Contact Name</FieldLabel>
            <Input
              value={quickCreate.contactName}
              onChange={(e) => setQuickCreate((q) => ({ ...q, contactName: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                value={quickCreate.email}
                onChange={(e) => setQuickCreate((q) => ({ ...q, email: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel>Phone Number</FieldLabel>
              <Input value={quickCreate.mobile} onChange={(e) => setQuickCreate((q) => ({ ...q, mobile: e.target.value }))} />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={contactQuickCreateOpen}
        onClose={() => setContactQuickCreateOpen(false)}
        title="Create Contact"
        footer={
          <>
            <Button variant="outline" onClick={() => setContactQuickCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitContactQuickCreate} disabled={contactQuickCreateSaving}>
              {contactQuickCreateSaving ? "Creating…" : "Create"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted">
            The account already exists — just capture the new stakeholder. You can fill in the rest later (you'll get a
            reminder).
          </p>
          <div>
            <FieldLabel required>Contact Name</FieldLabel>
            <Input
              value={contactQuickCreate.contactName}
              onChange={(e) => setContactQuickCreate((q) => ({ ...q, contactName: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                value={contactQuickCreate.email}
                onChange={(e) => setContactQuickCreate((q) => ({ ...q, email: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel>Phone Number</FieldLabel>
              <Input
                value={contactQuickCreate.mobile}
                onChange={(e) => setContactQuickCreate((q) => ({ ...q, mobile: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
