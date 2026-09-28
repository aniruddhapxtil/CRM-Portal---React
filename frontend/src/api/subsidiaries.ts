import { apiGet, apiPost } from "./client";
import type { Subsidiary, SubsidiaryFormIn, SubsidiaryOverviewRow, SaveResponse } from "../types/entities";

export const getSubsidiariesOverview = () => apiGet<SubsidiaryOverviewRow[]>("/subsidiaries/overview");
export const getSubsidiary = (id: number) => apiGet<Subsidiary>(`/subsidiary/${id}`);
export const saveSubsidiary = (data: SubsidiaryFormIn) =>
  apiPost<SaveResponse<"subsidiary_id">>("/subsidiary/save", data);
