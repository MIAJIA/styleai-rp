import { useState, useEffect, useRef } from "react"

interface PollingOptions<T> {
  jobId: string | null
  onUpdate: (data: T) => void
  onError: (error: Error) => void
}

export function usePolling<T>({ jobId, onUpdate, onError }: PollingOptions<T>) {
  const [isPolling, setIsPolling] = useState(false)
  const pollingIntervalIdRef = useRef<NodeJS.Timeout | null>(null)

  const stopPolling = () => {
    if (pollingIntervalIdRef.current) {
      clearInterval(pollingIntervalIdRef.current)
      pollingIntervalIdRef.current = null
      setIsPolling(false)
      console.log("[usePolling] Polling stopped.")
    }
  }

  useEffect(() => {
    if (!jobId) {
      stopPolling()
      return
    }

    const poll = async () => {
      if (!jobId) {
        // This check is a safeguard, the main effect below should handle teardown.
        stopPolling();
        return;
      }
      try {
        const response = await fetch(`/api/generation/status?jobId=${jobId}`)
        if (!response.ok) {
          // For status codes like 404 or 500, we treat it as a terminal error for this polling session.
          throw new Error(`Polling failed with status: ${response.status}`)
        }
        const data = await response.json() as T;
        onUpdate(data);

      } catch (error) {
        onError(error instanceof Error ? error : new Error("Unknown polling error"))
        stopPolling()
      }
    }

    // Start polling immediately and then set an interval
    setIsPolling(true)
    console.log(`[usePolling] Starting polling for jobId: ${jobId}`)
    poll()
    pollingIntervalIdRef.current = setInterval(poll, 5000)

    // Cleanup function
    return () => {
      stopPolling()
    }
  }, [jobId, onUpdate, onError])

  return { isPolling, stopPolling }
}