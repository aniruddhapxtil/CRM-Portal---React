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

/** Multipart audio upload — not routed through client.ts's JSON helpers. */
export async function processVoiceAudio(blob: Blob): Promise<VoiceProcessResponse> {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  return readJsonOrThrow(await fetch(`${BASE}/voice/process`, { method: "POST", body: form }));
}

export async function resumeVoiceDraft(draftId: number, additionalText: string): Promise<VoiceProcessResponse> {
  const form = new FormData();
  form.append("additional_text", additionalText);
  return readJsonOrThrow(await fetch(`${BASE}/voice/draft/${draftId}/resume`, { method: "POST", body: form }));
}

export const getVoiceDrafts = () => apiGet<VoiceDraftRow[]>("/voice/drafts");

export const commitVoiceDraft = (payload: VoiceCommitPayload) =>
  apiPost<VoiceCommitResponse>("/voice/commit", payload);
