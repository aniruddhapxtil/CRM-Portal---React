import { apiGet, apiPost } from "./client";
import type { Contact, ContactFormIn, ContactOverviewRow, SaveResponse } from "../types/entities";

export const getContactsOverview = () => apiGet<ContactOverviewRow[]>("/contacts/overview");
export const getContact = (id: number) => apiGet<Contact>(`/contact/${id}`);
export const saveContact = (data: ContactFormIn) =>
  apiPost<SaveResponse<"contact_id">>("/contact/save", data);
