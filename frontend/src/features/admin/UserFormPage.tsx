import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { FieldLabel, Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useToast } from "../../components/ui/Toast";
import { getUser, saveUser } from "../../api/adminUsers";
import { REGION_OPTIONS, ADMIN_ROLE_OPTIONS } from "../../constants/options";
import type { CrmUserFormIn } from "../../types/entities";

const BLANK: CrmUserFormIn = {
  user_name: "",
  email_id: "",
  designation: "",
  region: "",
  phone: "",
  role: "Sales Representative",
};

export function UserFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState<CrmUserFormIn>(BLANK);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getUser(Number(id))
      .then((u) => {
        if (cancelled) return;
        setForm({
          user_id: u.id,
          user_name: u.user_name,
          email_id: u.email_id,
          designation: u.designation ?? "",
          region: u.region ?? "",
          phone: u.phone ?? "",
          role: u.role ?? "Sales Representative",
        });
      })
      .catch(() => toast.show("Failed to load user.", "danger"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function set<K extends keyof CrmUserFormIn>(key: K, value: CrmUserFormIn[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const nameMissing = !form.user_name.trim();
  const emailMissing = !form.email_id.trim();
  const canSave = !nameMissing && !emailMissing;

  async function onSave() {
    setTouched(true);
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await saveUser(form);
      toast.show(isEdit ? "User updated." : "User created — they can sign in immediately.", "success");
      navigate(`/admin/users/${res.user_id}/edit`, { replace: true });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to save user.", "danger");
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
        title={isEdit ? "Edit User" : "New User"}
        subtitle="Add someone to the CRM and grant them sign-in access."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/admin/users")}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={!canSave || saving}>
              {saving ? "Saving…" : "Save User"}
            </Button>
          </>
        }
      />

      <Card>
        <p className="mb-4 rounded-lg border border-brand/30 bg-brand-tint/50 p-3 text-xs text-ink">
          Adding someone here both records them in the CRM and grants them sign-in access via Microsoft SSO — they'll
          be able to sign in with this email immediately.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <FieldLabel required error={touched && nameMissing ? "Full name is required." : undefined}>
              Full Name
            </FieldLabel>
            <Input
              value={form.user_name}
              onChange={(e) => set("user_name", e.target.value)}
              invalid={touched && nameMissing}
              placeholder="e.g. Aniruddha Patil"
            />
          </div>

          <div>
            <FieldLabel required error={touched && emailMissing ? "Email is required." : undefined}>
              Email
            </FieldLabel>
            <Input
              type="email"
              value={form.email_id}
              onChange={(e) => set("email_id", e.target.value)}
              invalid={touched && emailMissing}
              placeholder="name@data-phi.ai"
            />
          </div>

          <div>
            <FieldLabel required>Role</FieldLabel>
            <Select options={ADMIN_ROLE_OPTIONS} value={form.role} onChange={(e) => set("role", e.target.value)} />
          </div>

          <div>
            <FieldLabel>Designation</FieldLabel>
            <Input
              value={form.designation ?? ""}
              onChange={(e) => set("designation", e.target.value)}
              placeholder="e.g. ML Engineer"
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
            <FieldLabel>Phone</FieldLabel>
            <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+971 5xx xxx xxx" />
          </div>
        </div>
      </Card>
    </AppLayout>
  );
}
