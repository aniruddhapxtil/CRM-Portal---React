import { apiGet, apiPost } from "./client";
import type { DashboardPeriod, DashboardSummary } from "../types/entities";

export interface DashboardFilters {
  period?: DashboardPeriod;
  account_manager?: string;
  region?: string;
  source?: string;
  project_type?: string;
}

export const getDashboardSummary = (filters: DashboardFilters) => {
  const params = new URLSearchParams();
  if (filters.period) params.set("period", filters.period);
  if (filters.account_manager) params.set("account_manager", filters.account_manager);
  if (filters.region) params.set("region", filters.region);
  if (filters.source) params.set("source", filters.source);
  if (filters.project_type) params.set("project_type", filters.project_type);
  const qs = params.toString();
  return apiGet<DashboardSummary>(`/dashboard/summary${qs ? `?${qs}` : ""}`);
};

export const updateOpportunityExpectedClosureDate = (opportunityId: number, expectedClosureDate: string | null) =>
  apiPost<{ status: string; opportunity_id: number; expected_closure_date: string | null }>(
    `/opportunity/${opportunityId}/expected-closure-date`,
    { expected_closure_date: expectedClosureDate },
  );
