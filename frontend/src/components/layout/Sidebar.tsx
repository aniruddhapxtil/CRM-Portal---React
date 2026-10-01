import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { AttributeList } from "../ui/AttributeList";

interface SidebarProps {
  /** Example phrase shown under the mic button, e.g. "Add subsidiary Al Futtaim Retail". */
  voiceExample?: string;
  onMicClick?: () => void;
  recording?: boolean;
  /** Set to false to omit the Voice Entry card entirely (e.g. the Project form has no voice capture). */
  showVoiceEntry?: boolean;
  recordId?: number | string;
  createdBy?: string;
  creationDate?: string;
  attributes: string[];
  onAttributesChange: (value: string[]) => void;
  /** Extra cards (e.g. hierarchy drill-down shortcuts) rendered below the standard two. */
  children?: ReactNode;
}

export function Sidebar({
  voiceExample,
  onMicClick,
  recording,
  showVoiceEntry = true,
  recordId,
  createdBy,
  creationDate,
  attributes,
  onAttributesChange,
  children,
}: SidebarProps) {
  return (
    <aside className="flex w-full flex-col gap-4 lg:w-[340px] lg:shrink-0">
      {showVoiceEntry && (
        <Card accent="var(--color-brand)" title="Voice Entry">
          <button
            type="button"
            onClick={onMicClick}
            className={`tap-target flex w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors ${
              recording ? "bg-danger text-white" : "bg-brand text-ink hover:bg-brand-light"
            }`}
          >
            {recording ? "⏹ Stop Recording" : "🎤 Start Recording"}
          </button>
          {voiceExample && <p className="mt-2 text-xs italic text-muted">e.g. "{voiceExample}"</p>}
        </Card>
      )}

      <Card title="About this record">
        <div className="flex flex-col gap-2 text-xs text-muted">
          {recordId !== undefined && (
            <div className="flex justify-between">
              <span className="font-semibold">Record ID</span>
              <span className="text-ink">{recordId}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="font-semibold">Created By</span>
            <span className="text-ink">{createdBy ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Creation Date</span>
            <span className="text-ink">{creationDate ?? "—"}</span>
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-2 text-xs font-bold text-ink">Custom Attributes</div>
          <AttributeList value={attributes} onChange={onAttributesChange} />
        </div>
      </Card>

      {children}
    </aside>
  );
}
