import { apiGet, apiPost } from "./client";
import type { Account, AccountFormIn, AccountOverviewRow, SaveResponse } from "../types/entities";

export const getAccountsOverview = () => apiGet<AccountOverviewRow[]>("/accounts/overview");
export const getAccount = (id: number) => apiGet<Account>(`/account/${id}`);
export const saveAccount = (data: AccountFormIn) =>
  apiPost<SaveResponse<"account_id">>("/account/save", data);
