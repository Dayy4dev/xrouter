"use client";

import { useState } from "react";
import LongTaskBanner from "./LongTaskBanner";
import { useTaskStore } from "@/store/taskStore";
import { useRouter } from "next/navigation";

/**
 * Renders every running long task above the dashboard, mounted once in the
 * dashboard layout so navigation never unmounts it.
 *
 * Tasks run non-blockingly in the background by default (as corner chips)
 * so the operator can freely navigate and work while tasks progress.
 * Tasks are also tracked in NotificationBell.
 */
export default function TaskDock() {
  return null;
}

/**
 * One task = one banner. Default is a non-blocking corner chip unless explicitly
 * flagged with task.startForeground = true.
 */
function DockBanner({ task, startForeground = false }) {
  const router = useRouter();
  const [backgrounded, setBackgrounded] = useState(!startForeground);

  const canExpand = startForeground;

  const handleNavigate = () => {
    if (!task?.href || typeof window === "undefined") return;
    try {
      if (window.location.pathname === task.href) return;
      if (router && typeof router.push === "function") {
        router.push(task.href);
      } else {
        window.location.assign(task.href);
      }
    } catch {
      window.location.assign(task.href);
    }
  };

  return (
    <LongTaskBanner
      fixed={startForeground && !backgrounded}
      inlineChip={!startForeground}
      title={task.title}
      message={task.message}
      progress={task.progress ?? null}
      href={task.href}
      onNavigate={task.href ? handleNavigate : undefined}
      chipOnly={startForeground ? backgrounded : true}
      onCancel={() => useTaskStore.getState().cancel(task.id)}
      onBackground={() => setBackgrounded(true)}
      onExpand={() => setBackgrounded(false)}
      canExpand={canExpand}
    />
  );
}
