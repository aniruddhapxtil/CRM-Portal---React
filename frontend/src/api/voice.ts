import { apiGet, apiPost, redirectToLogin } from "./client";
import type { VoiceCommitPayload, VoiceCommitResponse, VoiceDraftRow, VoiceProcessResponse } from "../types/voice";

const BASE = "/api";

/** Shared by the two multipart calls below: session expiry goes to /login, other failures throw. */
async function readJsonOrThrow<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    redirectToLogin();
    throw new Error("Your session has ended. Redirecting to sign-in…");
  }
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail ?? res.statusText);
  return res.json();
}

/** Multipart audio upload — not routed through client.ts's JSON helpers.
 * `contextHint` tells the extractor which existing record (if any) is already open for editing,
 * so e.g. "next action date is the 10th of October" fills that record's own fields instead of
 * being treated as an attempt to describe a brand-new Account/Contact.
 * `knownFields` is that same record's already-known data (e.g. { lead: { lead_name, account... }}) —
 * it backfills whatever the extractor correctly left null, so the draft shown on the Voice Station
 * page reflects the full record this capture is about, not just the newly-spoken fields. */
export async function processVoiceAudio(
  blob: Blob,
  contextHint?: string,
  knownFields?: Record<string, Record<string, unknown>>,
): Promise<VoiceProcessResponse> {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  if (contextHint) form.append("context_hint", contextHint);
  if (knownFields) form.append("known_fields", JSON.stringify(knownFields));
  return readJsonOrThrow(await fetch(`${BASE}/voice/process`, { method: "POST", body: form }));
}

export const getVoiceDrafts = () => apiGet<VoiceDraftRow[]>("/voice/drafts");

export const commitVoiceDraft = (payload: VoiceCommitPayload) =>
  apiPost<VoiceCommitResponse>("/voice/commit", payload);
