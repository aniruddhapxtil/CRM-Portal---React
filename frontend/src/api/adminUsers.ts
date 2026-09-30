import { apiGet, apiPost } from "./client";
import type { CrmUser, CrmUserFormIn, CrmUserOverviewRow, SaveResponse } from "../types/entities";

export const getUsersOverview = () => apiGet<CrmUserOverviewRow[]>("/users/overview");
export const getUser = (id: number) => apiGet<CrmUser>(`/user/${id}`);
export const saveUser = (data: CrmUserFormIn) => apiPost<SaveResponse<"user_id">>("/user/save", data);
export const getRoles = () => apiGet<string[]>("/roles");
