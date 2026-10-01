import type { Tone } from "../components/ui/Badge";
import { SERVICE_LINE_OPTIONS } from "./options";

/** Gives every service line its own fixed color so the same line reads identically wherever
 * it's shown (Lead and Opportunity registry tables, detail panels). Falls back to "yellow" for
 * any legacy/unlisted value so the table never silently drops back to a flat neutral pill. */
const SERVICE_LINE_TONE: Record<(typeof SERVICE_LINE_OPTIONS)[number], Tone> = {
  "Data Engineering and Analytics": "royalblue",
  "PhAI - GenAI, AI and ML": "royalpurple",
  "Data Governance": "tealblue",
  "ESG Navigator": "neongreen",
};

export function serviceLineTone(line: string): Tone {
  return SERVICE_LINE_TONE[line as (typeof SERVICE_LINE_OPTIONS)[number]] ?? "yellow";
}
