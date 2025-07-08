import { useState, useEffect, useRef } from "react"

interface PollingOptions<T> {
  jobId: string | null
  onSuccess: (result: T) => void
  onError: (error: Error) => void
  onUpdate?: (status: any) => void
}

export function usePolling<T>({ jobId, onSuccess, onError, onUpdate }: PollingOptions<T>) {
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
      try {
        const response = await fetch(`/api/generation/status?jobId=${jobId}`)
        if (!response.ok) {
          throw new Error(`Polling failed with status: ${response.status}`)
        }
        const job = await response.json()

        if (onUpdate) {
          onUpdate(job)
        }

        if (job.status === "succeed" || job.status === "completed") {
          onSuccess(job.result)
          stopPolling()
        } else if (job.status === "failed" || job.status === "cancelled") {
          onError(new Error(job.error || `Job ${job.status}`))
          stopPolling()
        }
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
  }, [jobId, onSuccess, onError, onUpdate])

  return { isPolling, stopPolling }
}