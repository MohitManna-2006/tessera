import { EXPORT_STAGE_ORDER, type ExportStage } from "@/lib/export/protocol";

type TesseraProgressMarkProps = {
  completedStages: readonly ExportStage[];
  currentStage?: ExportStage;
  failed?: boolean;
};

export function TesseraProgressMark({
  completedStages,
  currentStage,
  failed = false,
}: TesseraProgressMarkProps) {
  const completedCount = completedStages.length;
  const currentLabel = currentStage
    ? EXPORT_STAGE_ORDER.indexOf(currentStage) + 1
    : completedCount;
  const label = failed
    ? `Export stopped at stage ${currentLabel} of 5`
    : `Export progress: ${completedCount} of 5 stages complete`;

  return (
    <div className="tessera-progress-mark" role="img" aria-label={label}>
      {EXPORT_STAGE_ORDER.map((stage) => {
        const status = completedStages.includes(stage)
          ? "complete"
          : currentStage === stage
            ? failed
              ? "failed"
              : "current"
            : "upcoming";
        return (
          <span
            className="progress-tile"
            data-status={status}
            aria-hidden="true"
            key={stage}
          />
        );
      })}
    </div>
  );
}
