import type { Account, Contact } from "../types/entities";

/** Heuristic used to flag a quickly-captured Account/Contact as needing follow-up. */
export function isAccountIncomplete(account: Pick<Account, "industry" | "region">): boolean {
  return !account.industry || !account.region;
}

export function isContactIncomplete(contact: Pick<Contact, "email" | "mobile" | "designation">): boolean {
  return (!contact.email && !contact.mobile) || !contact.designation;
}
