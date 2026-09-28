import { apiGet } from "./client";
import type { Lookups } from "../types/entities";

export const getLookups = () => apiGet<Lookups>("/lookups");
