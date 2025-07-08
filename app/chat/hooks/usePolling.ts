import { useState, useEffect, useRef, useCallback } from "react"

const MAX_CONSECUTIVE_FAILS = 3;

interface PollingOptions<T> {
  onPollingError?: (error: Error) => void
}

export function usePolling<T>(
  jobId: string | null,
  onUpdate: (data: T) => void,
  options?: PollingOptions<T>
) {
  const { onPollingError } = options || {};
  const [isPolling, setIsPolling] = useState(false)
  const [consecutiveFails, setConsecutiveFails] = useState(0);
  const pollingIntervalIdRef = useRef<NodeJS.Timeout | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingIntervalIdRef.current) {
      clearInterval(pollingIntervalIdRef.current)
      pollingIntervalIdRef.current = null
      setIsPolling(false)
      console.log("[usePolling] Polling stopped.")
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      stopPolling()
      setConsecutiveFails(0);
      return
    }

    const poll = async () => {
      if (!jobId) {
        stopPolling();
        return;
      }
      try {
        const response = await fetch(`/api/generation/status?jobId=${jobId}`)
        if (!response.ok) {
          throw new Error(`Polling failed with status: ${response.status}`)
        }
        const data = await response.json() as T;

        // Reset fail counter on success
        setConsecutiveFails(0);
        onUpdate(data);

      } catch (error) {
        const newFailCount = consecutiveFails + 1;
        setConsecutiveFails(newFailCount);
        console.warn(`[usePolling] Poll failed for job ${jobId}. Consecutive fails: ${newFailCount}`);

        if (newFailCount >= MAX_CONSECUTIVE_FAILS) {
          console.error(`[usePolling] Reached max consecutive fails (${MAX_CONSECUTIVE_FAILS}). Stopping polling.`);
          onPollingError?.(error instanceof Error ? error : new Error("Unknown polling error"));
          stopPolling();
        }
      }
    }

    // Start polling immediately and then set an interval
    setIsPolling(true)
    setConsecutiveFails(0);
    console.log(`[usePolling] Starting polling for jobId: ${jobId}`)
    poll() // Initial poll
    pollingIntervalIdRef.current = setInterval(poll, 5000)

    // Cleanup function
    return () => {
      stopPolling()
    }
  }, [jobId, onUpdate, onPollingError, stopPolling, consecutiveFails])

  const startPolling = useCallback(() => {
    if (!jobId || isPolling) return;
    setIsPolling(true);
    setConsecutiveFails(0);
    // The useEffect will handle the rest
  }, [jobId, isPolling]);

  return { isPolling, startPolling, stopPolling }
}