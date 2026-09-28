import { apiGet, apiPost } from "./client";
import type { Project, ProjectFormIn, ProjectOverviewRow, SaveResponse } from "../types/entities";

export const getProjectsOverview = () => apiGet<ProjectOverviewRow[]>("/projects/overview");
export const getProject = (id: number) => apiGet<Project>(`/project/${id}`);
export const saveProject = (data: ProjectFormIn) =>
  apiPost<SaveResponse<"project_id">>("/project/save", data);
