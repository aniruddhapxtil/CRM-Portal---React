import {
  OPPORTUNITY_STAGE_TRACK,
  OPPORTUNITY_STAGE_WON,
  OPPORTUNITY_STAGE_LOST,
} from "../../constants/options";
import { Button } from "./Button";

interface StageTrackProps {
  stage: string;
  onStageChange: (stage: string) => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
}

/** Opportunity pipeline widget: 3 clickable stage pills + separate Won/Lost outcome buttons. */
export function StageTrack({ stage, onStageChange, onMarkWon, onMarkLost }: StageTrackProps) {
  const activeIndex = OPPORTUNITY_STAGE_TRACK.indexOf(stage as (typeof OPPORTUNITY_STAGE_TRACK)[number]);
  const isWon = stage === OPPORTUNITY_STAGE_WON;
  const isLost = stage === OPPORTUNITY_STAGE_LOST;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {OPPORTUNITY_STAGE_TRACK.map((s, i) => {
          const done = !isWon && !isLost && i < activeIndex;
          const current = !isWon && !isLost && i === activeIndex;
          return (
            <button
              type="button"
              key={s}
              onClick={() => onStageChange(s)}
              className={`tap-target rounded-full border px-4 text-sm font-semibold transition-colors ${
                current
                  ? "border-brand bg-brand text-ink"
                  : done
                    ? "border-brand/50 bg-brand-tint text-ink"
                    : "border-border bg-surface text-muted hover:bg-canvas"
              }`}
            >
              {s}
            </button>
          );
        })}
        {isWon && <span className="rounded-full border border-success/40 bg-success-light px-4 py-2 text-sm font-semibold text-success">{OPPORTUNITY_STAGE_WON}</span>}
        {isLost && <span className="rounded-full border border-danger/40 bg-danger-light px-4 py-2 text-sm font-semibold text-danger">{OPPORTUNITY_STAGE_LOST}</span>}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant={isWon ? "primary" : "outline"} onClick={onMarkWon}>
          Mark Won
        </Button>
        <Button type="button" variant={isLost ? "danger" : "outline"} onClick={onMarkLost}>
          Mark Lost
        </Button>
      </div>
    </div>
  );
}
