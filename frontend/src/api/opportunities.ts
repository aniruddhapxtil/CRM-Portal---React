import { apiGet, apiPost } from "./client";
import type { Opportunity, OpportunityFormIn, OpportunityOverviewRow, OpportunitySaveResponse } from "../types/entities";

export const getOpportunitiesOverview = () => apiGet<OpportunityOverviewRow[]>("/opportunities/overview");
export const getOpportunity = (id: number) => apiGet<Opportunity>(`/opportunity/${id}`);
export const saveOpportunity = (data: OpportunityFormIn) =>
  apiPost<OpportunitySaveResponse>("/opportunity/save", data);
