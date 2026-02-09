import { useEffect, useCallback, useRef } from "react";
import { useRevalidator } from "@remix-run/react";

/**
 * Polls the current route's loader at a given interval using Remix's useRevalidator.
 * - Only polls when the browser tab is visible
 * - Skips if a revalidation is already in-flight
 * - Immediately revalidates when the tab becomes visible again
 */
export function usePolling(intervalMs: number = 15_000) {
  const revalidator = useRevalidator();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        revalidator.state === "idle"
      ) {
        revalidator.revalidate();
      }
    }, intervalMs);
  }, [intervalMs, revalidator]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    startPolling();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (revalidator.state === "idle") {
          revalidator.revalidate();
        }
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [startPolling, stopPolling, revalidator]);
}
