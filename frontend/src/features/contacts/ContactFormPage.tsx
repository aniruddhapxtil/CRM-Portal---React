import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Sidebar } from "../../components/layout/Sidebar";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { FieldLabel, Input, Textarea } from "../../components/ui/Input";
import { SearchableSelect, type SearchableOption } from "../../components/ui/SearchableSelect";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { getContact, saveContact } from "../../api/contacts";
import { getLookups } from "../../api/lookups";
import { COUNTRY_CODES, DEFAULT_COUNTRY_DIAL_CODE } from "../../constants/countryCodes";
import type { ContactFormIn, Lookups } from "../../types/entities";

const BLANK: ContactFormIn = {
  account_id: 0,
  subsidiary_id: null,
  contact_name: "",
  designation: "",
  department: "",
  linkedin_url: "",
  email: "",
  secondary_email: "",
  mobile_country_code: DEFAULT_COUNTRY_DIAL_CODE,
  mobile: "",
  secondary_mobile_country_code: DEFAULT_COUNTRY_DIAL_CODE,
  secondary_mobile: "",
  notes: "",
  attributes: [],
};

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const DIAL_OPTIONS: SearchableOption[] = COUNTRY_CODES.map((c) => ({
  value: c.dial,
  label: `${c.name} (${c.dial})`,
}));

export function ContactFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const isReadOnly = useAuth().role === "Executive";

  const [form, setForm] = useState<ContactFormIn>(BLANK);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    getLookups()
      .then((l) => !cancelled && setLookups(l))
      .catch(() => toast.show("Failed to load account/subsidiary lists.", "danger"));

    if (id) {
      getContact(Number(id))
        .then((con) => {
          if (cancelled) return;
          setForm({
            contact_id: con.id,
            account_id: con.account_id,
            subsidiary_id: con.subsidiary_id,
            contact_name: con.contact_name,
            designation: con.designation ?? "",
            department: con.department ?? "",
            linkedin_url: con.linkedin_url ?? "",
            email: con.email ?? "",
            secondary_email: con.secondary_email ?? "",
            mobile_country_code: con.mobile_country_code ?? DEFAULT_COUNTRY_DIAL_CODE,
            mobile: con.mobile ?? "",
            secondary_mobile_country_code: con.secondary_mobile_country_code ?? DEFAULT_COUNTRY_DIAL_CODE,
            secondary_mobile: con.secondary_mobile ?? "",
            notes: con.notes ?? "",
            attributes: con.attributes,
          });
        })
        .catch(() => toast.show("Failed to load contact.", "danger"))
        .finally(() => !cancelled && setLoading(false));
    } else {
      const accountId = searchParams.get("account_id");
      const subsidiaryId = searchParams.get("subsidiary_id");
      setForm((f) => ({
        ...f,
        account_id: accountId ? Number(accountId) : 0,
        subsidiary_id: subsidiaryId ? Number(subsidiaryId) : null,
      }));
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function set<K extends keyof ContactFormIn>(key: K, value: ContactFormIn[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setPhone(key: "mobile" | "secondary_mobile", raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    set(key, digits);
  }

  const accountOptions: SearchableOption[] =
    lookups?.accounts.map((a) => ({ value: a.id, label: a.account_name })) ?? [];

  const subsidiaryOptions: SearchableOption[] = useMemo(
    () =>
      (lookups?.subsidiaries ?? [])
        .filter((s) => !form.account_id || s.account_id === form.account_id)
        .map((s) => ({ value: s.id, label: s.subsidiary_name })),
    [lookups, form.account_id],
  );

  const nameMissing = !form.contact_name.trim();
  const accountMissing = !form.account_id;
  const emailInvalid = Boolean(form.email && !EMAIL_REGEX.test(form.email));
  const secondaryEmailInvalid = Boolean(form.secondary_email && !EMAIL_REGEX.test(form.secondary_email));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ contact_name: true, account_id: true, email: true, secondary_email: true });
    if (nameMissing || accountMissing || emailInvalid || secondaryEmailInvalid) return;
    setSaving(true);
    try {
      const res = await saveContact(form);
      toast.show(isEdit ? "Contact updated." : "Contact created.", "success");
      navigate(`/contacts/${res.contact_id}/edit`, { replace: true });
    } catch {
      toast.show("Failed to save contact.", "danger");
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
      <form onSubmit={onSubmit}>
        <PageHeader
          title={isEdit ? "Edit Contact" : "New Contact"}
          subtitle="Client stakeholder linked to an account (and optionally a subsidiary)."
          actions={
            <>
              <Button type="button" variant="outline" onClick={() => navigate("/contacts")}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || isReadOnly}>
                {saving ? "Saving…" : isReadOnly ? "Read-only" : "Save Contact"}
              </Button>
            </>
          }
        />

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1">
            <Card title="Contact Details">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel required error={touched.account_id && accountMissing ? "Account is required." : undefined}>
                    Account
                  </FieldLabel>
                  <SearchableSelect
                    options={accountOptions}
                    value={form.account_id || null}
                    onChange={(v) => {
                      set("account_id", Number(v) || 0);
                      set("subsidiary_id", null);
                    }}
                    placeholder="Search accounts…"
                    invalid={touched.account_id && accountMissing}
                  />
                </div>

                <div>
                  <FieldLabel helper="Optional — filtered by selected account.">Subsidiary</FieldLabel>
                  <SearchableSelect
                    options={subsidiaryOptions}
                    value={form.subsidiary_id ?? null}
                    onChange={(v) => set("subsidiary_id", v ? Number(v) : null)}
                    placeholder="Search subsidiaries…"
                    disabled={!form.account_id}
                  />
                </div>

                <div>
                  <FieldLabel
                    required
                    error={touched.contact_name && nameMissing ? "Contact name is required." : undefined}
                  >
                    Contact Name
                  </FieldLabel>
                  <Input
                    value={form.contact_name}
                    onChange={(e) => set("contact_name", e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, contact_name: true }))}
                    invalid={touched.contact_name && nameMissing}
                  />
                </div>

                <div>
                  <FieldLabel>Designation</FieldLabel>
                  <Input value={form.designation ?? ""} onChange={(e) => set("designation", e.target.value)} />
                </div>

                <div>
                  <FieldLabel>Department</FieldLabel>
                  <Input value={form.department ?? ""} onChange={(e) => set("department", e.target.value)} />
                </div>

                <div>
                  <FieldLabel>LinkedIn URL</FieldLabel>
                  <Input value={form.linkedin_url ?? ""} onChange={(e) => set("linkedin_url", e.target.value)} />
                </div>

                <div>
                  <FieldLabel error={touched.email && emailInvalid ? "Invalid email address format." : undefined}>
                    Email
                  </FieldLabel>
                  <Input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                    invalid={touched.email && emailInvalid}
                  />
                </div>

                <div>
                  <FieldLabel
                    error={touched.secondary_email && secondaryEmailInvalid ? "Invalid email address format." : undefined}
                  >
                    Secondary Email
                  </FieldLabel>
                  <Input
                    type="email"
                    value={form.secondary_email ?? ""}
                    onChange={(e) => set("secondary_email", e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, secondary_email: true }))}
                    invalid={touched.secondary_email && secondaryEmailInvalid}
                  />
                </div>

                <div>
                  <FieldLabel>Mobile</FieldLabel>
                  <div className="flex gap-2">
                    <div className="w-36 shrink-0">
                      <SearchableSelect
                        options={DIAL_OPTIONS}
                        value={form.mobile_country_code ?? null}
                        onChange={(v) => set("mobile_country_code", (v as string) ?? DEFAULT_COUNTRY_DIAL_CODE)}
                      />
                    </div>
                    <Input
                      className="flex-1"
                      value={form.mobile ?? ""}
                      onChange={(e) => setPhone("mobile", e.target.value)}
                      placeholder="50 123 4567"
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>Secondary Mobile</FieldLabel>
                  <div className="flex gap-2">
                    <div className="w-36 shrink-0">
                      <SearchableSelect
                        options={DIAL_OPTIONS}
                        value={form.secondary_mobile_country_code ?? null}
                        onChange={(v) =>
                          set("secondary_mobile_country_code", (v as string) ?? DEFAULT_COUNTRY_DIAL_CODE)
                        }
                      />
                    </div>
                    <Input
                      className="flex-1"
                      value={form.secondary_mobile ?? ""}
                      onChange={(e) => setPhone("secondary_mobile", e.target.value)}
                      placeholder="50 123 4567"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Notes</FieldLabel>
                  <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
                </div>
              </div>
            </Card>
          </div>

          <Sidebar
            voiceExample="Add contact Tariq Mansoor, VP of Data Science at DIEZ"
            recordId={isEdit ? `CON-${id}` : undefined}
            createdBy="—"
            attributes={form.attributes}
            onAttributesChange={(v) => set("attributes", v)}
          />
        </div>
      </form>
    </AppLayout>
  );
}
