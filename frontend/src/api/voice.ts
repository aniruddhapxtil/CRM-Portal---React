import { apiGet, apiPost } from "./client";
import type { VoiceCommitPayload, VoiceCommitResponse, VoiceDraftRow, VoiceProcessResponse } from "../types/voice";

const BASE = "/api";

/** Multipart audio upload — not routed through client.ts's JSON helpers. */
export async function processVoiceAudio(blob: Blob): Promise<VoiceProcessResponse> {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  const res = await fetch(`${BASE}/voice/process`, { method: "POST", body: form });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail ?? res.statusText);
  return res.json();
}

export async function resumeVoiceDraft(draftId: number, additionalText: string): Promise<VoiceProcessResponse> {
  const form = new FormData();
  form.append("additional_text", additionalText);
  const res = await fetch(`${BASE}/voice/draft/${draftId}/resume`, { method: "POST", body: form });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail ?? res.statusText);
  return res.json();
}

export const getVoiceDrafts = () => apiGet<VoiceDraftRow[]>("/voice/drafts");

export const commitVoiceDraft = (payload: VoiceCommitPayload) =>
  apiPost<VoiceCommitResponse>("/voice/commit", payload);
