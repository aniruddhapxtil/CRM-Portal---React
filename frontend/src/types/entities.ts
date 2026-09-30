// Mirrors backend/main.py's SQLAlchemy models + Pydantic *FormIn schemas exactly
// (post DBML-alignment migration). Do not add fields the backend doesn't send/accept.

export interface WithAttributes {
  /** Positional attribute_1..attribute_10, compacted (pack_attributes/unpack_attributes). */
  attributes: string[];
}

// ---------- Account ----------

export interface Account extends WithAttributes {
  id: number;
  account_name: string;
  account_manager: string | null;
  region: string | null;
  industry: string | null;
  website: string | null;
  notes: string | null;
}

export interface AccountOverviewRow extends Omit<Account, "attributes"> {
  creation_date: string;
  subsidiaries: { id: number; subsidiary_name: string; region: string; industry: string }[];
  contacts: { id: number; contact_name: string; designation: string; email: string; mobile: string }[];
}

export interface AccountFormIn extends WithAttributes {
  account_id?: number | null;
  account_name: string;
  account_manager?: string | null;
  region?: string | null;
  industry?: string | null;
  website?: string | null;
  notes?: string | null;
}

// ---------- Subsidiary ----------

export interface Subsidiary extends WithAttributes {
  id: number;
  account_id: number;
  subsidiary_name: string;
  region: string | null;
  industry: string | null;
  notes: string | null;
}

export interface SubsidiaryOverviewRow extends Omit<Subsidiary, "attributes"> {
  account_name: string;
  account_manager: string;
  creation_date: string;
  contacts: { id: number; contact_name: string; designation: string; email: string; mobile: string }[];
}

export interface SubsidiaryFormIn extends WithAttributes {
  subsidiary_id?: number | null;
  account_id: number;
  subsidiary_name: string;
  region?: string | null;
  industry?: string | null;
  notes?: string | null;
}

// ---------- Contact ----------

export interface Contact extends WithAttributes {
  id: number;
  account_id: number;
  subsidiary_id: number | null;
  contact_name: string;
  designation: string | null;
  department: string | null;
  linkedin_url: string | null;
  email: string | null;
  secondary_email: string | null;
  mobile_country_code: string | null;
  mobile: string | null;
  secondary_mobile_country_code: string | null;
  secondary_mobile: string | null;
  notes: string | null;
}

export interface ContactOverviewRow extends Omit<Contact, "attributes"> {
  account_name: string;
  subsidiary_name: string | null;
  creation_date: string;
  leads: { id: number; lead_name: string; stage: string; deal_size: number; currency: string }[];
  opportunities: { id: number; opportunity_name: string; stage: string; deal_size: number; currency: string }[];
}

export interface ContactFormIn extends WithAttributes {
  contact_id?: number | null;
  account_id: number;
  subsidiary_id?: number | null;
  contact_name: string;
  designation?: string | null;
  department?: string | null;
  linkedin_url?: string | null;
  email?: string | null;
  secondary_email?: string | null;
  mobile_country_code?: string | null;
  mobile?: string | null;
  secondary_mobile_country_code?: string | null;
  secondary_mobile?: string | null;
  notes?: string | null;
}

// ---------- Lead ----------

export interface Lead extends WithAttributes {
  id: number;
  account_id: number;
  subsidiary_id: number | null;
  contact_id: number;
  lead_name: string;
  account_manager: string | null;
  deal_size: number | null;
  currency: string | null;
  project_type: string | null;
  referred_by: string | null;
  /** Stored server-side as one varchar column; the API converts to/from string[]. */
  service_line: string[];
  stage: string | null;
  disqualification_reason: string | null;
  type: string | null;
  lead_source: string | null;
  campaign_name: string | null;
  technology: string[];
  next_steps: string | null;
  next_action_date: string | null;
  notes: string | null;
}

export interface LeadOverviewRow extends Omit<Lead, "attributes"> {
  account_name: string;
  contact_name: string;
  creation_date: string;
  opportunities: { id: number; opportunity_name: string; stage: string }[];
  activities: { id: number; activity_name: string; record_action: string; activity_date: string }[];
}

export interface LeadFormIn extends WithAttributes {
  lead_id?: number | null;
  account_id: number;
  subsidiary_id?: number | null;
  contact_id: number;
  lead_name: string;
  account_manager?: string | null;
  deal_size?: number | null;
  currency?: string | null;
  project_type?: string | null;
  referred_by?: string | null;
  service_line: string[];
  stage?: string | null;
  disqualification_reason?: string | null;
  type?: string | null;
  lead_source?: string | null;
  campaign_name?: string | null;
  technology: string[];
  next_steps?: string | null;
  next_action_date?: string | null;
  notes?: string | null;
}

// ---------- Opportunity ----------

export interface Opportunity extends WithAttributes {
  id: number;
  lead_id: number | null;
  account_id: number;
  subsidiary_id: number | null;
  contact_id: number;
  opportunity_name: string;
  account_manager: string | null;
  deal_size: number | null;
  currency: string | null;
  project_type: string | null;
  referred_by: string | null;
  service_line: string[];
  technology: string[];
  stage: string;
  probability: number | null;
  reason: string | null;
  opportunity_type: string | null;
  funded_by: string | null;
  opportunity_source: string | null;
  next_steps: string | null;
  next_action_date: string | null;
  expected_closure_date: string | null;
  notes: string | null;
}

export interface OpportunityOverviewRow extends Omit<Opportunity, "attributes"> {
  account_name: string;
  contact_name: string;
  lead_name: string | null;
  account_manager: string;
  creation_date: string;
  activities: { id: number; activity_name: string; record_action: string; activity_date: string }[];
}

export interface OpportunityFormIn extends WithAttributes {
  opportunity_id?: number | null;
  lead_id?: number | null;
  account_id: number;
  subsidiary_id?: number | null;
  contact_id: number;
  opportunity_name: string;
  account_manager?: string | null;
  deal_size?: number | null;
  currency?: string | null;
  project_type?: string | null;
  referred_by?: string | null;
  service_line: string[];
  technology: string[];
  stage: string;
  probability: number;
  reason?: string | null;
  opportunity_type?: string | null;
  funded_by?: string | null;
  opportunity_source?: string | null;
  next_steps?: string | null;
  next_action_date?: string | null;
  expected_closure_date?: string | null;
  notes?: string | null;
}

export interface OpportunitySaveResponse {
  status: string;
  opportunity_id: number;
  /** Non-null when saving flips stage to "Closed Won (100%)" — backend auto-creates a Project. */
  project_id: number | null;
}

// ---------- Project ----------

export interface Project extends WithAttributes {
  id: number;
  opportunity_id: number;
  account_id: number;
  subsidiary_id: number | null;
  contact_id: number;
  project_name: string;
  technology: string[];
  value: number | null;
  currency: string | null;
  start_date: string | null;
  close_date: string | null;
  po_status: string;
  po_number: string | null;
  po_reason: string | null;
  notes: string | null;
  po_document_name: string | null;
  po_uploaded_at: string | null;
}

export interface ProjectOverviewRow extends Omit<Project, "attributes"> {
  opportunity_name: string;
  account_name: string;
  creation_date: string;
}

export interface ProjectFormIn extends WithAttributes {
  project_id?: number | null;
  opportunity_id: number;
  account_id: number;
  subsidiary_id?: number | null;
  contact_id: number;
  project_name: string;
  technology: string[];
  value?: number | null;
  currency?: string | null;
  start_date?: string | null;
  close_date?: string | null;
  po_status?: string | null;
  po_number?: string | null;
  po_reason?: string | null;
  notes?: string | null;
}

// ---------- Activity ----------

export interface Activity extends WithAttributes {
  id: number;
  activity_name: string;
  record_type: string;
  linked_record_id: number | null;
  contact_id: number | null;
  record_action: string;
  activity_date: string | null;
  next_step: string | null;
  next_action_date: string | null;
  notes: string | null;
}

export interface ActivityOverviewRow extends Omit<Activity, "attributes"> {
  linked_label: string;
}

export interface ActivityFormIn extends WithAttributes {
  activity_id?: number | null;
  activity_name: string;
  record_type: string;
  linked_record_id: number;
  contact_id?: number | null;
  record_action: string;
  activity_date?: string | null;
  next_step?: string | null;
  next_action_date?: string | null;
  notes?: string | null;
}

// ---------- Lookups ----------

export interface Lookups {
  accounts: { id: number; account_name: string; account_manager: string | null; region: string | null; industry: string | null }[];
  subsidiaries: { id: number; subsidiary_name: string; account_id: number; account_name: string | null; region: string | null; industry: string | null }[];
  contacts: {
    id: number;
    contact_name: string;
    account_id: number;
    account_name: string | null;
    subsidiary_id: number | null;
    subsidiary_name: string | null;
    designation: string | null;
    email: string | null;
    mobile: string | null;
  }[];
  leads: {
    id: number;
    lead_name: string;
    account_id: number;
    account_name: string | null;
    subsidiary_id: number | null;
    contact_id: number;
    contact_name: string | null;
    stage: string | null;
    type: string | null;
    deal_size: number | null;
    currency: string | null;
    project_type: string | null;
    service_line: string[];
    technology: string[];
    referred_by: string | null;
  }[];
  opportunities: {
    id: number;
    opportunity_name: string;
    account_id: number;
    account_name: string | null;
    subsidiary_id: number | null;
    contact_id: number;
    contact_name: string | null;
    lead_id: number | null;
    stage: string;
    deal_size: number | null;
    currency: string | null;
    technology: string[];
    service_line: string[];
  }[];
  projects: {
    id: number;
    project_name: string;
    opportunity_id: number;
    account_id: number;
    account_name: string | null;
    contact_id: number;
    stage: string;
  }[];
}

export type SaveResponse<K extends string> = { status: string } & Record<K, number>;

// ---------- Admin: Users (CRM `user` table + auth_service `users` table) ----------

export interface CrmUserOverviewRow {
  id: number;
  user_name: string;
  email_id: string;
  designation: string;
  region: string;
  phone: string;
  role: string | null;
  creation_date: string;
  can_sign_in: boolean;
  last_login_at: string | null;
}

export interface CrmUser {
  id: number;
  user_name: string;
  email_id: string;
  designation: string | null;
  region: string | null;
  phone: string | null;
  role: string | null;
}

export interface CrmUserFormIn {
  user_id?: number | null;
  user_name: string;
  email_id: string;
  designation?: string | null;
  region?: string | null;
  phone?: string | null;
  role: string;
}
