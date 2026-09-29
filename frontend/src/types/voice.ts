export interface VoiceLatency {
  whisper_ms?: number;
  transcribe_ms?: number;
  llm_ms?: number;
  bedrock_ms?: number;
  backend_total_ms?: number;
}

export interface ExtractedAccount {
  account_name?: string | null;
  account_manager?: string | null;
  region?: string | null;
  industry?: string | null;
}

export interface ExtractedSubsidiary {
  subsidiary_name?: string | null;
  region?: string | null;
  industry?: string | null;
}

export interface ExtractedContact {
  contact_name?: string | null;
  designation?: string | null;
  email?: string | null;
  mobile?: string | null;
  linkedin_url?: string | null;
  notes?: string | null;
}

export interface ExtractedLead {
  lead_name?: string | null;
  deal_size?: number | null;
  currency?: string | null;
  type?: string | null;
  stage?: string | null;
  lead_source?: string | null;
  service?: string | null;
  technology?: string | null;
  next_steps?: string | null;
  next_action_date?: string | null;
  closure_date?: string | null;
  notes?: string | null;
}

export interface ExtractedOpportunity {
  opportunity_name?: string | null;
  deal_size?: number | null;
  currency?: string | null;
  project_type?: string | null;
  service?: string | null;
  stage?: string | null;
  probability?: number | null;
  technology?: string | null;
  next_steps?: string | null;
  next_action_date?: string | null;
  closure_date?: string | null;
  notes?: string | null;
}

export interface VoiceExtractedData {
  account?: ExtractedAccount;
  subsidiary?: ExtractedSubsidiary;
  contact?: ExtractedContact;
  lead?: ExtractedLead;
  opportunity?: ExtractedOpportunity;
}

export interface VoiceProcessResponse {
  status: string;
  draft_id: number | null;
  intent: string;
  transcript: string;
  extracted_data: VoiceExtractedData;
  missing_fields: string[];
  clarification_prompt: string | null;
  telemetry?: { latency?: VoiceLatency; costs?: Record<string, number>; tokens?: Record<string, number> };
}

export interface VoiceDraftRow {
  id: number;
  target_entity: string;
  raw_transcript: string;
  extracted_data: VoiceExtractedData;
  missing_fields: string[];
  clarification_prompt: string | null;
  status: string;
  creation_date: string;
}

export interface VoiceCommitPayload {
  draft_id: number | null;
  intent: string;
  user_id?: number | null;
  account: ExtractedAccount;
  subsidiary?: ExtractedSubsidiary;
  contact: ExtractedContact;
  lead?: ExtractedLead;
  opportunity?: ExtractedOpportunity;
}

export interface VoiceCommitResponse {
  status: string;
  intent: string;
  created_records: Record<string, unknown>;
  commit_ms?: number;
}
