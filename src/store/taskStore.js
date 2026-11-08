"use client";

import { create } from "zustand";

/**
 * Long operations that outlive the page that started them.
 *
 * A 10 000-proxy import runs as a client-side loop of POSTs; the page component
 * that drives it unmounts when the operator navigates, and with it went the
 * banner - the loop kept running invisibly with nowhere to report progress.
 * Moving the operation's progress into this store lets a banner mounted in the
 * dashboard layout keep reporting it, keep offering cancel, and stay collapsed
 * in a corner while the operator works somewhere else.
 *
 * A task carries its own `onCancel` (an AbortController.abort wired by the
 * caller), so cancelling from anywhere aborts the real request loop.
 */
export const DONE_TTL_MS = 30000;

export const useTaskStore = create((set, get) => ({
  /** [{ id, title, message, section, progress, state, onCancel, href, finishedAt }] */
  tasks: [],

  start(task) {
    set((s) => ({
      tasks: [
        ...s.tasks.filter((t) => t.id !== task.id),
        { progress: 0, state: "running", ...task },
      ],
    }));
  },

  update(id, patch) {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  },

  finish(id) {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id && t.state !== "done"
          ? { ...t, state: "done", progress: 100, finishedAt: Date.now() }
          : t
      ),
    }));
    const timer = setTimeout(() => {
      const st = get();
      const task = st.tasks.find((t) => t.id === id);
      if (task && task.state === "done") st.dismiss(id);
    }, DONE_TTL_MS);
    if (typeof timer.unref === "function") timer.unref();
  },

  dismiss(id) {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  /** Fire a task's own cancel hook; the caller's finally{} removes it. */
  cancel(id) {
    const task = get().tasks.find((t) => t.id === id);
    if (task && typeof task.onCancel === "function") {
      try {
        task.onCancel();
      } catch (err) {
        console.error("Task onCancel error:", err);
      }
    }
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },
}));

export default useTaskStore;
