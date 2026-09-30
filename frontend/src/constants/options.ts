// Literal option lists ported 1:1 from the original templates/*.html pages.
// Single point of truth — do not re-hardcode these in feature pages.

export const REGION_OPTIONS = ["Dubai", "Abu Dhabi", "Sharjah", "KSA", "Other"] as const;

export const INDUSTRY_OPTIONS = [
  "Retail",
  "Real Estate, Construction & Engineering",
  "Conglomerate",
  "F&B / FMCG",
  "Automotive",
  "Manufacturing",
  "BFSI",
  "Healthcare",
  "Logistics",
  "Aviation",
  "Public Sector",
  "Telco",
  "E-Com",
  "Facilities Management",
  "Others",
] as const;

export const CURRENCY_OPTIONS = ["AED", "USD", "SAR"] as const;

export const PROJECT_TYPE_OPTIONS = ["T&M", "Fixed Cost", "POC"] as const;

/** Note: this option's label legitimately contains a comma — see backend's SERVICE_LINE_DELIM. */
export const SERVICE_LINE_OPTIONS = [
  "Data Engineering and Analytics",
  "PhAI - GenAI, AI and ML",
  "Data Governance",
  "ESG Navigator",
] as const;

export const TECHNOLOGY_OPTIONS = ["Azure", "AWS", "Databricks", "Other"] as const;

export const LEAD_STAGE_OPTIONS = ["Qualified", "Disqualified"] as const;

export const LEAD_TYPE_OPTIONS = ["Warm", "Cold", "Hot"] as const;

export const DISQUALIFICATION_REASON_OPTIONS = [
  "No requirement",
  "No budget",
  "No response",
  "Duplicate",
  "Wrong contact",
  "Outside scope",
  "Other",
] as const;

/** Shared by Lead.lead_source and Opportunity.opportunity_source. */
export const SOURCE_OPTIONS = ["Outbound", "Inbound", "Website", "Event", "Referral", "Partner", "Campaign"] as const;

export const OPPORTUNITY_TYPE_OPTIONS = ["New", "Upsell", "Cross Sell", "Renewal", "Support"] as const;

export const FUNDED_BY_OPTIONS = ["Client", "Microsoft", "Amazon", "Snowflake"] as const;

/** Must byte-for-byte match the backend's Opportunity.stage default / DB values (em-dash, not hyphen). */
export const OPPORTUNITY_STAGE_TRACK = ["Discovery — 40%", "Tech Discussion — 60%", "Proposal — 80%"] as const;
export const OPPORTUNITY_STAGE_WON = "Closed Won (100%)";
export const OPPORTUNITY_STAGE_LOST = "Closed Lost (0%)";

export const OPPORTUNITY_STAGE_PROBABILITY: Record<string, number> = {
  "Discovery — 40%": 40,
  "Tech Discussion — 60%": 60,
  "Proposal — 80%": 80,
  [OPPORTUNITY_STAGE_WON]: 100,
  [OPPORTUNITY_STAGE_LOST]: 0,
};

export const LOST_REASON_OPTIONS = [
  "Commercial / Price",
  "Competitor",
  "Budget / Funding",
  "Project Deferred / No Decision",
  "Technical Solution Fit",
  "Other",
] as const;

export const PO_STATUS_OPTIONS = ["Awaited", "Received", "Validated", "Closed", "Cancelled"] as const;

export const ACTIVITY_RECORD_TYPE_OPTIONS = ["Account", "Lead", "Opportunity", "Project", "Campaign"] as const;

export const ACTIVITY_RECORD_ACTION_OPTIONS = ["Email", "LinkedIn", "Meeting", "Phone Call", "WhatsApp", "Messages"] as const;

/** Must exactly match auth_service.models.ROLES — that's what actually gates sign-in access. */
export const ADMIN_ROLE_OPTIONS = ["Admin", "Executive", "Team Lead", "Sales Representative"] as const;
