import { apiGet, apiPost } from "./client";
import type { QualificationRequestRow, SaveResponse } from "../types/entities";

export const getQualificationsOverview = () => apiGet<QualificationRequestRow[]>("/qualifications/overview");

export const requestLeadQualification = (leadId: number) =>
  apiPost<SaveResponse<"request_id">>(`/qualifications/lead/${leadId}/request`, {});

export const requestOpportunityQualification = (opportunityId: number) =>
  apiPost<SaveResponse<"request_id">>(`/qualifications/opportunity/${opportunityId}/request`, {});

export const approveQualification = (id: number) =>
  apiPost<SaveResponse<"request_id">>(`/qualifications/${id}/approve`, {});

export const revokeQualification = (id: number) =>
  apiPost<SaveResponse<"request_id">>(`/qualifications/${id}/revoke`, {});
