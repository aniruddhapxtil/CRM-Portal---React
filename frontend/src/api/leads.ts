import { apiGet, apiPost } from "./client";
import type { Lead, LeadFormIn, LeadOverviewRow, SaveResponse } from "../types/entities";

export const getLeadsOverview = () => apiGet<LeadOverviewRow[]>("/leads/overview");
export const getLead = (id: number) => apiGet<Lead>(`/lead/${id}`);
export const saveLead = (data: LeadFormIn) => apiPost<SaveResponse<"lead_id">>("/lead/save", data);
