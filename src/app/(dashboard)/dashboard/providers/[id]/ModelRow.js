import PropTypes from "prop-types";
import { CapacityBadges, ModelTierBadge } from "@/shared/components";

export default function ModelRow({ model, fullModel, alias, copied, onCopy, testStatus, latencyMs, isCustom, isFree, onDeleteAlias, onTest, isTesting, onDisable, caps, thinkingSuffix }) {
  const displayModel = thinkingSuffix ? `${fullModel}(${thinkingSuffix})` : fullModel;
  const borderColor = testStatus === "ok"
    ? "border-success-border"
    : testStatus === "error"
    ? "border-danger-border"
    : "border-border";

  const iconColor = testStatus === "ok"
    ? "#22c55e"
    : testStatus === "error"
    ? "#ef4444"
    : undefined;

  return (
    <div className={`group min-w-0 max-w-full rounded-[5px] border px-2 py-1 ${borderColor} hover:bg-sidebar/50 text-[11px]`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className="material-symbols-outlined shrink-0 text-[13px]"
          style={iconColor ? { color: iconColor } : undefined}
        >
          {testStatus === "ok" ? "check_circle" : testStatus === "error" ? "cancel" : "smart_toy"}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0">
          <div className="flex items-center gap-1">
            <code className="max-w-[70vw] truncate rounded bg-sidebar px-1 py-0.5 font-mono text-[10.5px] text-text-muted sm:max-w-[300px]">{displayModel}</code>
            <ModelTierBadge model={model} providerId={fullModel?.split("/")?.[0] || ""} isFree={isFree} />
          </div>
          <span className="flex min-w-0 items-center text-[8px] gap-1 pl-0.5">
            {model.name && <span className="truncate text-[8px] italic text-text-muted/70">{model.name}</span>}
            <CapacityBadges caps={caps} colorOverride="text-text-muted/70" size={9} />
            {Number.isFinite(latencyMs) && latencyMs > 0 && (
              <span
                className={`px-1 py-0.2 rounded font-mono text-[8px] font-medium ${
                  testStatus === "ok"
                    ? latencyMs < 800
                      ? "text-emerald-500 bg-emerald-500/10"
                      : latencyMs < 2500
                      ? "text-amber-500 bg-amber-500/10"
                      : "text-orange-500 bg-orange-500/10"
                    : "text-red-500 bg-red-500/10"
                }`}
                title={`Ping response latency: ${latencyMs}ms`}
              >
                {latencyMs < 1000 ? `${latencyMs}ms` : `${(latencyMs / 1000).toFixed(1)}s`}
              </span>
            )}
          </span>
        </div>
        {onTest && (
          <div className="relative shrink-0 group/btn">
            <button
              onClick={onTest}
              disabled={isTesting}
              className={`rounded p-0.5 text-text-muted transition-colors hover:bg-sidebar hover:text-primary ${isTesting ? "opacity-100 text-primary" : "opacity-80 hover:opacity-100"}`}
              title="Test Model"
            >
              <span className="material-symbols-outlined text-[11px]" style={isTesting ? { animation: "spin 1s linear infinite" } : undefined}>
                {isTesting ? "progress_activity" : "science"}
              </span>
            </button>
            <span className="pointer-events-none absolute mt-1 top-3.5 left-1/2 -translate-x-1/2 text-[8px] text-text-muted whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity">
              {isTesting ? "Testing..." : "Test"}
            </span>
          </div>
        )}
        <div className="relative shrink-0 group/btn">
          <button
            onClick={() => onCopy(displayModel, `model-${model.id}`)}
            className="rounded p-0.5 text-text-muted hover:bg-sidebar hover:text-primary"
          >
            <span className="material-symbols-outlined text-[11px]">
              {copied === `model-${model.id}` ? "check" : "content_copy"}
            </span>
          </button>
          <span className="pointer-events-none absolute mt-1 top-3.5 left-1/2 -translate-x-1/2 text-[8px] text-text-muted whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity">
            {copied === `model-${model.id}` ? "Copied!" : "Copy"}
          </span>
        </div>
        {isCustom ? (
          <div className="ml-auto flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {onDisable && (
              <button
                onClick={onDisable}
                className="rounded p-0.5 text-text-muted hover:bg-sidebar hover:text-amber-500"
                title="Disable model"
              >
                <span className="material-symbols-outlined text-[11px]">block</span>
              </button>
            )}
            <button
              onClick={onDeleteAlias}
              className="rounded p-0.5 text-text-muted hover:bg-danger-bg hover:text-danger"
              title="Remove custom model"
            >
              <span className="material-symbols-outlined text-[11px]">close</span>
            </button>
          </div>
        ) : onDisable ? (
          <button
            onClick={onDisable}
            className="ml-auto rounded p-0.5 text-text-muted opacity-100 transition-opacity hover:bg-danger-bg hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
            title="Disable model"
          >
            <span className="material-symbols-outlined text-[11px]">close</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

ModelRow.propTypes = {
  model: PropTypes.shape({
    id: PropTypes.string.isRequired,
  }).isRequired,
  fullModel: PropTypes.string.isRequired,
  alias: PropTypes.string,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  testStatus: PropTypes.oneOf(["ok", "error"]),
  latencyMs: PropTypes.number,
  isCustom: PropTypes.bool,
  isFree: PropTypes.bool,
  onDeleteAlias: PropTypes.func,
  onTest: PropTypes.func,
  isTesting: PropTypes.bool,
  onDisable: PropTypes.func,
  caps: PropTypes.object,
  thinkingSuffix: PropTypes.string,
};
