import { apiGet, apiPost } from "./client";
import type { Activity, ActivityFormIn, ActivityOverviewRow, SaveResponse } from "../types/entities";

export const getActivitiesOverview = () => apiGet<ActivityOverviewRow[]>("/activities/overview");
export const getActivity = (id: number) => apiGet<Activity>(`/activity/${id}`);
export const saveActivity = (data: ActivityFormIn) =>
  apiPost<SaveResponse<"activity_id">>("/activity/save", data);
