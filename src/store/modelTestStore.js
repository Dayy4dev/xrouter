"use client";

import { create } from "zustand";
import { useTaskStore } from "./taskStore";

export const useModelTestStore = create((set, get) => ({
  // tests: { [providerKey]: { isTestingAll: boolean, progress: { current, total, passed, failed } | null, results: { [id]: "ok"|"error" }, latencies: { [id]: number }, testingModelIds: string[], error: string } }
  tests: {},
  _cancelFns: {},

  getTestState: (providerKey) => {
    return (
      get().tests[providerKey] || {
        isTestingAll: false,
        progress: null,
        results: {},
        latencies: {},
        testingModelIds: [],
        error: "",
      }
    );
  },

  testSingleModel: async (providerKey, modelId) => {
    if (!providerKey || !modelId) return false;
    const currentState = get().tests[providerKey] || {};
    const testingModelIds = currentState.testingModelIds || [];
    if (testingModelIds.includes(modelId)) return false;

    set((s) => {
      const prev = s.tests[providerKey] || {};
      return {
        tests: {
          ...s.tests,
          [providerKey]: {
            ...prev,
            testingModelIds: [...(prev.testingModelIds || []), modelId],
          },
        },
      };
    });

    const start = Date.now();
    let isOk = false;
    let latency = 0;
    let errorMsg = "";

    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: `${providerKey}/${modelId}` }),
      });
      const data = await res.json();
      latency = Number.isFinite(data.latencyMs) ? data.latencyMs : (Date.now() - start);
      isOk = !!data.ok;
      errorMsg = isOk ? "" : (data.error || "Model not reachable");
    } catch {
      latency = Date.now() - start;
      isOk = false;
      errorMsg = "Network error";
    } finally {
      set((s) => {
        const prev = s.tests[providerKey] || {};
        return {
          tests: {
            ...s.tests,
            [providerKey]: {
              ...prev,
              testingModelIds: (prev.testingModelIds || []).filter((id) => id !== modelId),
              results: { ...(prev.results || {}), [modelId]: isOk ? "ok" : "error" },
              latencies: { ...(prev.latencies || {}), [modelId]: latency },
              error: errorMsg,
            },
          },
        };
      });
    }

    return isOk;
  },

  testAllModels: async ({ providerKey, targetIds, providerTitle, href }) => {
    if (!providerKey || !targetIds?.length) return;
    const currentState = get().tests[providerKey];
    if (currentState?.isTestingAll) return;

    // Normalize IDs to strings
    const rawIds = targetIds
      .map((item) => (typeof item === "string" ? item : item?.id))
      .filter(Boolean);
    if (!rawIds.length) return;

    let cancelled = false;
    set((s) => ({
      _cancelFns: {
        ...s._cancelFns,
        [providerKey]: () => {
          cancelled = true;
        },
      },
      tests: {
        ...s.tests,
        [providerKey]: {
          ...(s.tests[providerKey] || {}),
          isTestingAll: true,
          progress: { current: 0, total: rawIds.length, passed: 0, failed: 0 },
          error: "",
        },
      },
    }));

    const taskId = `test-models-${providerKey}`;
    const total = rawIds.length;
    let completed = 0;
    let passed = 0;
    let failed = 0;

    useTaskStore.getState().start({
      id: taskId,
      title: `Testing ${providerTitle || providerKey} models`,
      message: `Testing models: 0/${total}`,
      progress: 0,
      href: href || (typeof window !== "undefined" ? window.location.pathname : `/dashboard/providers`),
      onCancel: () => {
        cancelled = true;
      },
    });

    const queue = [...rawIds];
    const workerCount = Math.min(4, queue.length);

    const worker = async () => {
      while (queue.length > 0) {
        if (cancelled) break;
        const modelId = queue.shift();
        if (!modelId) break;

        // Mark as actively testing in store
        set((s) => {
          const prev = s.tests[providerKey] || {};
          return {
            tests: {
              ...s.tests,
              [providerKey]: {
                ...prev,
                testingModelIds: [...(prev.testingModelIds || []), modelId],
              },
            },
          };
        });

        const start = Date.now();
        let isOk = false;
        let latency = 0;
        try {
          const res = await fetch("/api/models/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: `${providerKey}/${modelId}` }),
          });
          const data = await res.json();
          latency = Number.isFinite(data.latencyMs) ? data.latencyMs : (Date.now() - start);
          isOk = !!data.ok;
        } catch {
          latency = Date.now() - start;
          isOk = false;
        }

        completed++;
        if (isOk) passed++;
        else failed++;

        const pct = Math.min(100, Math.round((completed / total) * 100));

        set((s) => {
          const prev = s.tests[providerKey] || {};
          return {
            tests: {
              ...s.tests,
              [providerKey]: {
                ...prev,
                testingModelIds: (prev.testingModelIds || []).filter((id) => id !== modelId),
                progress: { current: completed, total, passed, failed },
                results: { ...(prev.results || {}), [modelId]: isOk ? "ok" : "error" },
                latencies: { ...(prev.latencies || {}), [modelId]: latency },
              },
            },
          };
        });

        useTaskStore.getState().update(taskId, {
          progress: pct,
          message: `Testing models: ${completed}/${total} (${passed} passed, ${failed} failed)`,
        });
      }
    };

    try {
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
    } finally {
      set((s) => {
        const prev = s.tests[providerKey] || {};
        return {
          tests: {
            ...s.tests,
            [providerKey]: {
              ...prev,
              isTestingAll: false,
              progress: null,
              testingModelIds: [],
            },
          },
        };
      });

      useTaskStore.getState().update(taskId, {
        progress: 100,
        message: `Completed: ${passed}/${total} passed${failed > 0 ? `, ${failed} failed` : ""}`,
      });
      useTaskStore.getState().finish(taskId);
    }
  },

  cancelTest: (providerKey) => {
    const fn = get()._cancelFns[providerKey];
    if (fn) fn();
    const taskId = `test-models-${providerKey}`;
    useTaskStore.getState().cancel(taskId);
  },

  clearResults: (providerKey) => {
    set((s) => ({
      tests: {
        ...s.tests,
        [providerKey]: {
          ...(s.tests[providerKey] || {}),
          results: {},
          latencies: {},
          error: "",
        },
      },
    }));
  },
}));

export default useModelTestStore;
