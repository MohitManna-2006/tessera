"use client";

import { useEffect, useReducer, useRef } from "react";

import {
  parseExportStreamEvent,
  type ServerExportStage,
} from "@/lib/export/protocol";
import {
  createPortfolioExportSnapshot,
  type PortfolioValidationIssue,
} from "@/lib/portfolio-validation";
import type { Portfolio } from "@/lib/portfolio";

import {
  exportReducer,
  INITIAL_EXPORT_STATE,
  isExportRunning,
} from "./export-state";

const FAILURE_MESSAGE =
  "We couldn't package your portfolio. Your draft is safe.";
const DEVELOPMENT_FAILURE_MESSAGE =
  "Development failure stopped this export before download. Your draft is safe.";
const DEVELOPMENT_FAILURE_STAGES = new Set<ServerExportStage>([
  "generating",
  "verifying",
  "packaging",
]);
export const EXPORT_STAGE_MINIMUM_MS = 850;

function getDevelopmentFailureStage() {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") {
    return undefined;
  }

  const parameters = new URLSearchParams(window.location.search);
  const requestedFailureStage = parameters.get("failStage");
  return requestedFailureStage &&
    DEVELOPMENT_FAILURE_STAGES.has(requestedFailureStage as ServerExportStage)
    ? (requestedFailureStage as ServerExportStage)
    : undefined;
}

function decodeBase64(value: string) {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function initiateBrowserDownload(
  archiveBase64: string,
  filename: string,
  mimeType: string,
) {
  const blob = new Blob([decodeBase64(archiveBase64)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

type UsePortfolioExportOptions = {
  onInvalid: (issue: PortfolioValidationIssue) => void;
};

export function usePortfolioExport({ onInvalid }: UsePortfolioExportOptions) {
  const [state, dispatch] = useReducer(exportReducer, INITIAL_EXPORT_STATE);
  const runningRef = useRef(false);
  const downloadInitiatedRef = useRef(false);
  const currentStageRef = useRef<ServerExportStage>("preparing");
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | undefined>(undefined);
  const timeoutCancellationsRef = useRef(new Map<number, () => void>());
  const developmentFailureStage = getDevelopmentFailureStage();

  useEffect(() => {
    const timeoutCancellations = timeoutCancellationsRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runningRef.current = false;
      abortControllerRef.current?.abort();
      for (const [timeoutId, cancel] of timeoutCancellations) {
        window.clearTimeout(timeoutId);
        cancel();
      }
      timeoutCancellations.clear();
    };
  }, []);

  const waitForPresentation = (duration: number) => {
    if (duration <= 0) {
      return Promise.resolve(mountedRef.current);
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      let timeoutId = 0;
      const settle = (completed: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        timeoutCancellationsRef.current.delete(timeoutId);
        resolve(completed);
      };

      timeoutId = window.setTimeout(() => settle(mountedRef.current), duration);
      timeoutCancellationsRef.current.set(timeoutId, () => settle(false));
    });
  };

  const start = async (portfolio: Portfolio) => {
    if (runningRef.current) {
      return;
    }

    const snapshot = createPortfolioExportSnapshot(portfolio);
    if (!snapshot.success) {
      onInvalid(snapshot.issues[0]);
      return;
    }

    runningRef.current = true;
    downloadInitiatedRef.current = false;
    currentStageRef.current = "preparing";
    dispatch({ type: "start" });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let displayedStageStartedAt = Date.now();
    const isActive = () =>
      mountedRef.current &&
      !abortController.signal.aborted &&
      abortControllerRef.current === abortController;
    const waitForCurrentStage = async () => {
      const elapsed = Date.now() - displayedStageStartedAt;
      const remaining = Math.max(0, EXPORT_STAGE_MINIMUM_MS - elapsed);
      return (await waitForPresentation(remaining)) && isActive();
    };

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(snapshot.data),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Export request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";
      let exportFinished = false;

      const handleLine = async (line: string) => {
        if (!line.trim()) {
          return;
        }
        const event = parseExportStreamEvent(JSON.parse(line) as unknown);
        if (event.type === "stage") {
          if (!(await waitForCurrentStage())) {
            exportFinished = true;
            return;
          }
          if (developmentFailureStage === event.current) {
            currentStageRef.current = event.current;
            dispatch({
              type: "failed",
              stage: event.current,
              message: DEVELOPMENT_FAILURE_MESSAGE,
            });
            abortController.abort();
            exportFinished = true;
            return;
          }
          currentStageRef.current = event.current;
          dispatch({ type: "server-stage", stage: event.current });
          displayedStageStartedAt = Date.now();
          return;
        }
        if (event.type === "failure") {
          while (!(await reader.read()).done) {
            // Failure is a final protocol event; finish the request cleanly.
          }
          currentStageRef.current = event.stage;
          dispatch({
            type: "failed",
            stage: event.stage,
            message: event.message,
          });
          exportFinished = true;
          return;
        }
        if (!(await waitForCurrentStage())) {
          exportFinished = true;
          return;
        }
        if (downloadInitiatedRef.current) {
          throw new Error("Duplicate archive event.");
        }

        while (!(await reader.read()).done) {
          // Archive is the final protocol event; finish the request cleanly.
        }
        dispatch({ type: "ready" });
        downloadInitiatedRef.current = true;
        initiateBrowserDownload(
          event.archiveBase64,
          event.filename,
          event.mimeType,
        );
        dispatch({ type: "download-started" });
        exportFinished = true;
      };

      while (true) {
        const { value, done } = await reader.read();
        buffered += decoder.decode(value, { stream: !done });
        const lines = buffered.split("\n");
        buffered = lines.pop() ?? "";
        for (const line of lines) {
          await handleLine(line);
          if (exportFinished) {
            break;
          }
        }
        if (exportFinished) {
          if (!abortController.signal.aborted) {
            while (!(await reader.read()).done) {
              // The protocol ends after failure or archive; drain to a clean close.
            }
          }
          break;
        }
        if (done) {
          if (!exportFinished && buffered) {
            await handleLine(buffered);
          }
          break;
        }
      }

      if (!exportFinished) {
        throw new Error("Export stream ended before completion.");
      }
    } catch {
      if (isActive()) {
        dispatch({
          type: "failed",
          stage: currentStageRef.current,
          message: FAILURE_MESSAGE,
        });
      }
    } finally {
      runningRef.current = false;
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = undefined;
      }
    }
  };

  return {
    state,
    isRunning: isExportRunning(state.status),
    start,
    close: () => dispatch({ type: "close" }),
  };
}
