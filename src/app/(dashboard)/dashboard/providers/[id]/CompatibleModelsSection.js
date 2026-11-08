"use client";

import { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { Button, ModelTierBadge } from "@/shared/components";
import { useTaskStore } from "@/store/taskStore";
import { useModelTestStore } from "@/store/modelTestStore";
import { getProviderCustomModelRows } from "@/shared/utils/providerCustomModels";

function CompatibleModelRow({ modelId, fullModel, copied, onCopy, onDeleteAlias, onTest, testStatus, latencyMs, isTesting }) {
  const borderColor = testStatus === "ok"
    ? "border-green-500/40"
    : testStatus === "error"
    ? "border-red-500/40"
    : "border-border";

  const iconColor = testStatus === "ok"
    ? "#22c55e"
    : testStatus === "error"
    ? "#ef4444"
    : undefined;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${borderColor} hover:bg-sidebar/50`}>
      <span
        className="material-symbols-outlined text-base text-text-muted"
        style={iconColor ? { color: iconColor } : undefined}
      >
        {testStatus === "ok" ? "check_circle" : testStatus === "error" ? "cancel" : "smart_toy"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate">{modelId}</p>
          <ModelTierBadge model={modelId} />
          {Number.isFinite(latencyMs) && latencyMs > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded font-mono text-[10px] font-medium ${
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
        </div>
        <div className="flex items-center gap-1 mt-1">
          <code className="text-xs text-text-muted font-mono bg-sidebar px-1.5 py-0.5 rounded">{fullModel}</code>
          <div className="relative group/btn">
            <button
              onClick={() => onCopy(fullModel, `model-${modelId}`)}
              className="p-0.5 hover:bg-sidebar rounded text-text-muted hover:text-primary"
            >
              <span className="material-symbols-outlined text-sm">
                {copied === `model-${modelId}` ? "check" : "content_copy"}
              </span>
            </button>
            <span className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 text-[10px] text-text-muted whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity">
              {copied === `model-${modelId}` ? "Copied!" : "Copy"}
            </span>
          </div>
          {onTest && (
            <div className="relative group/btn">
              <button
                onClick={onTest}
                disabled={isTesting}
                className="p-0.5 hover:bg-sidebar rounded text-text-muted hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-sm" style={isTesting ? { animation: "spin 1s linear infinite" } : undefined}>
                  {isTesting ? "progress_activity" : "science"}
                </span>
              </button>
              <span className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 text-[10px] text-text-muted whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity">
                {isTesting ? "Testing..." : "Test"}
              </span>
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onDeleteAlias}
        className="p-1 hover:bg-red-500/10 rounded text-red-500"
        title="Remove model"
      >
        <span className="material-symbols-outlined text-sm">delete</span>
      </button>
    </div>
  );
}

CompatibleModelRow.propTypes = {
  modelId: PropTypes.string.isRequired,
  fullModel: PropTypes.string.isRequired,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  onDeleteAlias: PropTypes.func.isRequired,
  onTest: PropTypes.func,
  testStatus: PropTypes.string,
  latencyMs: PropTypes.number,
  isTesting: PropTypes.bool,
};

export default function CompatibleModelsSection({ providerStorageAlias, providerDisplayAlias, modelAliases, customModels, copied, onCopy, onDeleteAlias, onAddCustomModel, onDeleteCustomModel, connections, isAnthropic }) {
  const [newModel, setNewModel] = useState("");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingFailed, setDeletingFailed] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [modelStatusFilter, setModelStatusFilter] = useState("all");

  const providerKey = providerStorageAlias;
  const testState = useModelTestStore((s) => s.tests[providerKey]);
  const isTestingAll = !!testState?.isTestingAll;
  const testAllProgress = testState?.progress || null;
  const modelTestResults = testState?.results || {};
  const modelTestLatencies = testState?.latencies || {};
  const testingModelIds = useMemo(() => new Set(testState?.testingModelIds || []), [testState?.testingModelIds]);

  const handleTestModel = (modelId) => {
    return useModelTestStore.getState().testSingleModel(providerKey, modelId);
  };

  const handleTestAllModels = (targetModels) => {
    return useModelTestStore.getState().testAllModels({
      providerKey,
      targetIds: targetModels.map((m) => m.id),
      providerTitle: providerDisplayAlias || "provider",
      href: typeof window !== "undefined" ? window.location.pathname : `/dashboard/providers/${providerKey}`,
    });
  };

  const handleDeleteFailedModels = async (failedModels) => {
    if (!failedModels?.length || deletingFailed) return;
    if (!window.confirm(`Delete/remove ${failedModels.length} failed model(s)?`)) return;
    setDeletingFailed(true);
    try {
      const customIds = failedModels.filter((m) => m.source === "custom").map((m) => m.id);
      const aliasList = failedModels.filter((m) => m.source === "legacyAlias" && m.alias).map((m) => m.alias);

      if (customIds.length > 0) {
        await fetch("/api/models/custom", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerAlias: providerStorageAlias,
            ids: customIds,
          }),
        });
      }

      for (const alias of aliasList) {
        await onDeleteAlias(alias);
      }

      await fetchCustomModels();
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("customModelChanged"));
    } catch (error) {
      console.log("Error deleting failed models:", error);
    } finally {
      setDeletingFailed(false);
    }
  };

  const allModels = getProviderCustomModelRows({
    customModels,
    modelAliases,
    providerAlias: providerStorageAlias,
    type: "llm",
  });

  const filteredModels = allModels.filter(({ id }) => {
    if (modelSearchQuery.trim()) {
      const q = modelSearchQuery.trim().toLowerCase();
      if (!id.toLowerCase().includes(q)) return false;
    }
    if (modelStatusFilter !== "all") {
      const status = modelTestResults[id];
      if (modelStatusFilter === "ok" && status !== "ok") return false;
      if (modelStatusFilter === "error" && status !== "error") return false;
      if (modelStatusFilter === "untested" && status) return false;
    }
    return true;
  });

  const handleAdd = async () => {
    if (!newModel.trim() || adding) return;
    const modelId = newModel.trim();
    if (allModels.some((model) => model.id === modelId)) {
      alert("Model already exists for this provider.");
      return;
    }

    setAdding(true);
    try {
      await onAddCustomModel(modelId);
      setNewModel("");
    } catch (error) {
      console.log("Error adding model:", error);
    } finally {
      setAdding(false);
    }
  };

  const LIST_TIMEOUT_MS = 20000;
  const handleImport = async () => {
    if (importing) return;
    const activeConnection = connections.find((conn) => conn.isActive !== false);
    if (!activeConnection) {
      alert("Please add an active connection first to fetch models.");
      return;
    }

    setImporting(true);
    const taskId = `models-import-${activeConnection.id}`;
    useTaskStore.getState().start({
      id: taskId,
      title: "Importing models",
      message: "Fetching model list",
      progress: 0,
      href: typeof window !== "undefined" ? window.location.pathname : null,
    });
    try {
      const controller = new AbortController();
      const listTimer = setTimeout(() => controller.abort(), LIST_TIMEOUT_MS);
      let res;
      try {
        res = await fetch(`/api/providers/${activeConnection.id}/models`, {
          signal: controller.signal,
        });
      } catch (listError) {
        if (listError?.name === "AbortError") {
          alert("Fetching the model list timed out after 20 seconds.");
          return;
        }
        throw listError;
      } finally {
        clearTimeout(listTimer);
      }

      const rawText = await res.text().catch(() => "");
      let data = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        throw new Error(rawText.includes("<!DOCTYPE") ? `Upstream returned HTML page instead of JSON (${res.status} ${res.statusText})` : rawText.slice(0, 150));
      }

      if (!res.ok) {
        alert(data?.error || `Failed to import models (${res.status})`);
        return;
      }
      const rawModels = data?.models || [];
      if (rawModels.length === 0) {
        alert("No models returned from /models endpoint (upstream returned an empty data list).");
        return;
      }

      // Filter only new models to import
      const existingIds = new Set(allModels.map((m) => m.id));
      const toAdd = [];
      for (const model of rawModels) {
        const modelId = model.id || model.name || model.model;
        if (modelId && !existingIds.has(modelId)) {
          toAdd.push(modelId);
          existingIds.add(modelId);
        }
      }

      if (toAdd.length === 0) {
        alert("All models already exist in the list. No new models added.");
        return;
      }

      useTaskStore.getState().update(taskId, {
        message: `Saving ${toAdd.length} models...`,
        progress: 50,
      });

      // Fast batch import via single POST request
      const batchRes = await fetch("/api/models/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerAlias: providerStorageAlias,
          models: toAdd.map((id) => ({ id, type: "llm" })),
        }),
      });

      if (batchRes.ok) {
        await onAddCustomModel(toAdd[0]); // Trigger parent state refresh
        useTaskStore.getState().update(taskId, {
          message: `Imported ${toAdd.length} models`,
          progress: 100,
          state: "done",
        });
        alert(`Successfully imported ${toAdd.length} models!`);
      } else {
        alert("Failed to save imported models.");
      }
    } catch (error) {
      console.log("Error importing models:", error);
      alert("Error importing models: " + (error?.message || "Network error"));
    } finally {
      useTaskStore.getState().finish(taskId);
      setImporting(false);
    }
  };

  const canImport = connections.some((conn) => conn.isActive !== false);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Add {isAnthropic ? "Anthropic" : "OpenAI"}-compatible models manually or import them from the /models endpoint.
      </p>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <label htmlFor="new-compatible-model-input" className="text-xs text-text-muted mb-1 block">Model ID</label>
          <input
            id="new-compatible-model-input"
            type="text"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={isAnthropic ? "claude-3-opus-20240229" : "gpt-4o"}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          />
        </div>
        <Button size="sm" icon="add" onClick={handleAdd} disabled={!newModel.trim() || adding}>
          {adding ? "Adding..." : "Add"}
        </Button>
        <Button size="sm" variant="secondary" icon="download" onClick={handleImport} disabled={!canImport || importing}>
          {importing ? "Importing..." : "Import from /models"}
        </Button>
        {connections.length > 0 && allModels.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            icon={isTestingAll ? "progress_activity" : "science"}
            onClick={() => handleTestAllModels(allModels)}
            disabled={isTestingAll || importing}
          >
            {isTestingAll
              ? `Testing... ${testAllProgress ? `(${testAllProgress.current}/${testAllProgress.total})` : ""}`
              : "Test All"}
          </Button>
        )}
        {(() => {
          const failedModels = allModels.filter((m) => modelTestResults[m.id] === "error");
          if (!failedModels.length) return null;
          return (
            <Button
              size="sm"
              variant="secondary"
              icon="delete_sweep"
              onClick={() => handleDeleteFailedModels(failedModels)}
              disabled={isTestingAll || deletingFailed || importing}
              className="text-amber-500 hover:text-amber-400 hover:border-amber-500/30"
              title="Remove models that failed the ping test"
            >
              {deletingFailed ? "Removing..." : `Delete Failed (${failedModels.length})`}
            </Button>
          );
        })()}
      </div>

      {isTestingAll && testAllProgress && (
        <div className="w-full bg-border/40 rounded-full h-1.5 overflow-hidden -mt-1 mb-1">
          <div
            className="bg-primary h-full transition-all duration-300 rounded-full"
            style={{
              width: `${Math.min(100, Math.round((testAllProgress.current / (testAllProgress.total || 1)) * 100))}%`,
            }}
          />
        </div>
      )}

      {allModels.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="relative flex-1 w-full">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-text-muted">
              search
            </span>
            <input
              type="text"
              placeholder="Search models by id or name..."
              value={modelSearchQuery}
              onChange={(e) => setModelSearchQuery(e.target.value)}
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-7 text-xs focus:border-primary focus:outline-none"
            />
            {modelSearchQuery && (
              <button
                onClick={() => setModelSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-[11px] text-text-muted whitespace-nowrap">Status:</span>
            <select
              value={modelStatusFilter}
              onChange={(e) => setModelStatusFilter(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
            >
              <option value="all">All Models</option>
              <option value="ok">Reachable (OK)</option>
              <option value="error">Failed (Error)</option>
              <option value="untested">Untested</option>
            </select>
          </div>
        </div>
      )}

      {!canImport && (
        <p className="text-xs text-text-muted">
          Add a connection to enable importing models.
        </p>
      )}

      {allModels.length > 0 && filteredModels.length === 0 && (
        <p className="text-xs text-text-muted">No models match the current filter.</p>
      )}

      {filteredModels.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredModels.map(({ id, alias, source }) => (
            <CompatibleModelRow
              key={`${source}-${providerStorageAlias}/${id}`}
              modelId={id}
              fullModel={`${providerDisplayAlias}/${id}`}
              copied={copied}
              onCopy={onCopy}
              onDeleteAlias={() => source === "custom" ? onDeleteCustomModel(id) : onDeleteAlias(alias)}
              onTest={connections.length > 0 ? () => handleTestModel(id) : undefined}
              testStatus={modelTestResults[id]}
              latencyMs={modelTestLatencies[id]}
              isTesting={testingModelIds.has(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

CompatibleModelsSection.propTypes = {
  providerStorageAlias: PropTypes.string.isRequired,
  providerDisplayAlias: PropTypes.string.isRequired,
  modelAliases: PropTypes.object.isRequired,
  customModels: PropTypes.arrayOf(PropTypes.object),
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  onDeleteAlias: PropTypes.func.isRequired,
  onAddCustomModel: PropTypes.func.isRequired,
  onDeleteCustomModel: PropTypes.func.isRequired,
  connections: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    isActive: PropTypes.bool,
  })).isRequired,
  isAnthropic: PropTypes.bool,
};
