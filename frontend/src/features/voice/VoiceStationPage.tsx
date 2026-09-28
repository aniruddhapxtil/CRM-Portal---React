import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { FieldLabel, Input, Textarea } from "../../components/ui/Input";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { useToast } from "../../components/ui/Toast";
import { useVoiceCapture } from "../../hooks/useVoiceCapture";
import { commitVoiceDraft, getVoiceDrafts, processVoiceAudio, resumeVoiceDraft } from "../../api/voice";
import type {
  ExtractedAccount,
  ExtractedContact,
  ExtractedLead,
  ExtractedOpportunity,
  VoiceDraftRow,
  VoiceExtractedData,
  VoiceProcessResponse,
} from "../../types/voice";

const EMPTY_FIELDS: VoiceExtractedData = { account: {}, contact: {}, lead: {}, opportunity: {} };

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function draftStatusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "COMPLETED" || status === "STAGED_READY") return "success";
  if (status === "INCOMPLETE") return "warning";
  return "neutral";
}

export function VoiceStationPage() {
  const { show } = useToast();
  const { isRecording, elapsedMs, error: micError, startRecording, stopRecording } = useVoiceCapture();

  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState("Ready");
  const [transcript, setTranscript] = useState("");
  const [draftId, setDraftId] = useState<number | null>(null);
  const [intent, setIntent] = useState("create_lead");
  const [fields, setFields] = useState<VoiceExtractedData>(EMPTY_FIELDS);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [clarificationPrompt, setClarificationPrompt] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<VoiceProcessResponse["telemetry"] | null>(null);
  const [followUpText, setFollowUpText] = useState("");
  const [committed, setCommitted] = useState<Record<string, unknown> | null>(null);

  const [drafts, setDrafts] = useState<VoiceDraftRow[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);

  const missing = useMemo(() => new Set(missingFields), [missingFields]);

  const refreshDrafts = () => {
    setDraftsLoading(true);
    getVoiceDrafts()
      .then(setDrafts)
      .catch(() => show("Could not load recent voice drafts.", "danger"))
      .finally(() => setDraftsLoading(false));
  };

  useEffect(refreshDrafts, []);

  function applyResponse(res: VoiceProcessResponse) {
    setTranscript(res.transcript);
    setDraftId(res.draft_id);
    setIntent(res.intent);
    setFields({
      account: res.extracted_data.account ?? {},
      contact: res.extracted_data.contact ?? {},
      lead: res.extracted_data.lead ?? {},
      opportunity: res.extracted_data.opportunity ?? {},
    });
    setMissingFields(res.missing_fields ?? []);
    setClarificationPrompt(res.clarification_prompt ?? null);
    setTelemetry(res.telemetry ?? null);
    setCommitted(null);
  }

  async function handleMicClick() {
    if (isRecording) {
      setBusy(true);
      setStatusText("Transcribing & extracting entities…");
      try {
        const blob = await stopRecording();
        if (!blob) throw new Error("No audio captured.");
        const res = await processVoiceAudio(blob);
        applyResponse(res);
        setStatusText(res.status === "draft_saved_incomplete" ? "Missing required fields" : "Staged for review");
      } catch (err) {
        setStatusText("Error");
        show(err instanceof Error ? err.message : "Voice processing failed.", "danger");
      } finally {
        setBusy(false);
        refreshDrafts();
      }
      return;
    }
    setStatusText("Recording…");
    await startRecording();
  }

  async function handlePatchDraft() {
    if (!draftId || !followUpText.trim()) return;
    setBusy(true);
    setStatusText("Updating draft…");
    try {
      const res = await resumeVoiceDraft(draftId, followUpText.trim());
      applyResponse(res);
      setFollowUpText("");
      setStatusText("Draft updated");
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not update the draft.", "danger");
      setStatusText("Error");
    } finally {
      setBusy(false);
      refreshDrafts();
    }
  }

  function updateField<K extends keyof VoiceExtractedData>(
    section: K,
    key: keyof NonNullable<VoiceExtractedData[K]>,
    value: string
  ) {
    setFields((prev) => ({
      ...prev,
      [section]: { ...(prev[section] as Record<string, unknown>), [key]: value },
    }));
  }

  async function handleCommit() {
    setBusy(true);
    setStatusText("Committing to CRM…");
    try {
      const res = await commitVoiceDraft({
        draft_id: draftId,
        intent,
        account: fields.account as ExtractedAccount,
        contact: fields.contact as ExtractedContact,
        lead: fields.lead as ExtractedLead,
        opportunity: fields.opportunity as ExtractedOpportunity,
      });
      setCommitted(res.created_records);
      setStatusText(`Committed in ${res.commit_ms ?? 0}ms`);
      show("Record committed to the CRM.", "success");
      refreshDrafts();
    } catch (err) {
      show(err instanceof Error ? err.message : "Commit failed.", "danger");
      setStatusText("Error");
    } finally {
      setBusy(false);
    }
  }

  function inspectDraft(row: VoiceDraftRow) {
    setTranscript(row.raw_transcript);
    setDraftId(row.id);
    setIntent(row.target_entity);
    setFields({
      account: row.extracted_data.account ?? {},
      contact: row.extracted_data.contact ?? {},
      lead: row.extracted_data.lead ?? {},
      opportunity: row.extracted_data.opportunity ?? {},
    });
    setMissingFields(row.missing_fields ?? []);
    setClarificationPrompt(row.clarification_prompt ?? null);
    setTelemetry(null);
    setCommitted(null);
    setStatusText(`Loaded draft #${row.id}`);
  }

  const canCommit = !busy && Boolean(fields.account?.account_name) && Boolean(fields.contact?.contact_name);

  const totalMs = telemetry?.latency?.backend_total_ms ?? 0;
  const whisperMs = telemetry?.latency?.transcribe_ms ?? telemetry?.latency?.whisper_ms ?? 0;
  const llmMs = telemetry?.latency?.llm_ms ?? telemetry?.latency?.bedrock_ms ?? 0;

  const draftColumns: DataTableColumn<VoiceDraftRow>[] = [
    { key: "id", header: "Draft", primary: true, render: (r) => `#${r.id}` },
    {
      key: "target",
      header: "Target",
      render: (r) => (
        <Badge tone="brand" className="capitalize">
          {r.target_entity.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "transcript",
      header: "Transcript",
      render: (r) => <span className="line-clamp-1 max-w-xs text-muted">{r.raw_transcript}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={draftStatusTone(r.status)}>{r.status}</Badge>,
    },
    { key: "created", header: "Created", render: (r) => r.creation_date },
    {
      key: "action",
      header: "",
      render: (r) => (
        <Button variant="outline" onClick={() => inspectDraft(r)} className="h-8 px-3 text-xs">
          Inspect
        </Button>
      ),
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        crumb="Voice CRM Ingestion Engine"
        title="Universal Voice Station"
        subtitle="Speak commercial notes — the engine transcribes, extracts entities, and stages every field for review before it's committed."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[420px_1fr]">
        {/* Console */}
        <Card title="Voice Console">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-canvas/60 p-6">
            <button
              onClick={handleMicClick}
              disabled={busy}
              className={`tap-target flex h-20 w-20 items-center justify-center rounded-full text-3xl text-white shadow-lg transition-colors disabled:opacity-50 ${
                isRecording ? "animate-pulse bg-danger" : "bg-brand"
              }`}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? "⏹" : "🎤"}
            </button>
            <div className="text-lg font-bold tabular-nums text-ink">{formatMs(elapsedMs)}</div>
            <div className="text-xs font-semibold text-muted">{statusText}</div>
          </div>

          {micError && (
            <div className="mt-3 rounded-lg border border-danger/30 bg-danger-light/50 p-3 text-xs font-medium text-danger">
              {micError}
            </div>
          )}

          {clarificationPrompt && missing.size > 0 && (
            <div className="mt-4 flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-light/40 p-3">
              <p className="text-xs font-semibold text-warning">{clarificationPrompt}</p>
              <Textarea
                rows={2}
                value={followUpText}
                onChange={(e) => setFollowUpText(e.target.value)}
                placeholder="Type the missing details…"
              />
              <Button variant="outline" disabled={busy || !followUpText.trim()} onClick={handlePatchDraft}>
                Patch Draft
              </Button>
            </div>
          )}

          {telemetry && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="brand">⚡ Total {totalMs}ms</Badge>
              <Badge tone="success">🎙️ Transcribe {whisperMs}ms</Badge>
              <Badge tone="warning">🧠 LLM {llmMs}ms</Badge>
            </div>
          )}
        </Card>

        {/* Review */}
        <Card
          title="Transcript & Review"
          actions={draftId ? <span className="font-mono text-xs text-muted">Draft #{draftId}</span> : undefined}
        >
          <div className="mb-4 min-h-[44px] rounded-lg border border-border bg-canvas/50 px-3 py-2 text-sm italic text-muted">
            {transcript || "Recorded transcript will appear here."}
          </div>

          {committed ? (
            <div className="rounded-lg border border-success/30 bg-success-light/50 p-4 text-sm text-success">
              <p className="mb-1 font-bold">✅ Record confirmed &amp; committed</p>
              <pre className="whitespace-pre-wrap font-mono text-xs">{JSON.stringify(committed, null, 2)}</pre>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldGroup title="🏢 Enterprise Account">
                <FieldLabel required error={missing.has("account.account_name") ? "Required" : undefined}>
                  Account Name
                </FieldLabel>
                <Input
                  invalid={missing.has("account.account_name")}
                  value={fields.account?.account_name ?? ""}
                  onChange={(e) => updateField("account", "account_name", e.target.value)}
                />
                <FieldLabel>Account Manager</FieldLabel>
                <Input
                  value={fields.account?.account_manager ?? ""}
                  onChange={(e) => updateField("account", "account_manager", e.target.value)}
                />
                <FieldLabel>Region</FieldLabel>
                <Input
                  value={fields.account?.region ?? ""}
                  onChange={(e) => updateField("account", "region", e.target.value)}
                />
              </FieldGroup>

              <FieldGroup title="👤 Stakeholder Contact">
                <FieldLabel required error={missing.has("contact.contact_name") ? "Required" : undefined}>
                  Contact Name
                </FieldLabel>
                <Input
                  invalid={missing.has("contact.contact_name")}
                  value={fields.contact?.contact_name ?? ""}
                  onChange={(e) => updateField("contact", "contact_name", e.target.value)}
                />
                <FieldLabel>Designation</FieldLabel>
                <Input
                  value={fields.contact?.designation ?? ""}
                  onChange={(e) => updateField("contact", "designation", e.target.value)}
                />
                <FieldLabel>Email</FieldLabel>
                <Input
                  type="email"
                  value={fields.contact?.email ?? ""}
                  onChange={(e) => updateField("contact", "email", e.target.value)}
                />
              </FieldGroup>

              <FieldGroup title="💼 Opportunity & Lead" className="sm:col-span-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Title</FieldLabel>
                    <Input
                      value={fields.opportunity?.opportunity_name ?? fields.lead?.lead_name ?? ""}
                      onChange={(e) => {
                        updateField("opportunity", "opportunity_name", e.target.value);
                        updateField("lead", "lead_name", e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <FieldLabel>Deal Size</FieldLabel>
                    <Input
                      type="number"
                      value={fields.opportunity?.deal_size ?? fields.lead?.deal_size ?? ""}
                      onChange={(e) => {
                        updateField("opportunity", "deal_size", e.target.value);
                        updateField("lead", "deal_size", e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <FieldLabel>Technology</FieldLabel>
                    <Input
                      value={fields.opportunity?.technology ?? fields.lead?.technology ?? ""}
                      onChange={(e) => {
                        updateField("opportunity", "technology", e.target.value);
                        updateField("lead", "technology", e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <FieldLabel>Next Steps</FieldLabel>
                    <Input
                      value={fields.opportunity?.next_steps ?? fields.lead?.next_steps ?? ""}
                      onChange={(e) => {
                        updateField("opportunity", "next_steps", e.target.value);
                        updateField("lead", "next_steps", e.target.value);
                      }}
                    />
                  </div>
                </div>
              </FieldGroup>
            </div>
          )}

          <div className="mt-5 flex justify-end border-t border-border pt-4">
            <Button disabled={!canCommit} onClick={handleCommit}>
              💾 Confirm &amp; Commit to CRM
            </Button>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-extrabold text-ink">Recent Voice Drafts &amp; Sessions</h2>
        <DataTable
          rows={drafts}
          columns={draftColumns}
          getRowId={(r) => r.id}
          searchPlaceholder="Search drafts…"
          filterRow={(r, q) => r.raw_transcript.toLowerCase().includes(q) || r.target_entity.toLowerCase().includes(q)}
          emptyMessage={draftsLoading ? "Loading…" : "No voice drafts yet."}
        />
      </div>
    </AppLayout>
  );
}

function FieldGroup({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 rounded-lg border border-border p-3 ${className}`}>
      <h4 className="text-xs font-extrabold text-ink">{title}</h4>
      {children}
    </div>
  );
}
