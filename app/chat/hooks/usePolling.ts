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
  const pollingNumber = useRef<number>(0)

  // 🔍 FIX: 添加上次数据的引用，避免不必要的更新
  const lastDataRef = useRef<T | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingIntervalIdRef.current) {
      clearInterval(pollingIntervalIdRef.current)
      pollingIntervalIdRef.current = null
      setIsPolling(false)
      pollingNumber.current = 0;
      console.log("[usePolling] Polling stopped.")
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      stopPolling()
      setConsecutiveFails(0);
      lastDataRef.current = null;
      return
    
    }
    if (!isPolling) return
    if (pollingIntervalIdRef.current) return

    const poll = async () => {
      if (!jobId) {
        stopPolling();
        return;
      }
      const now = new Date().toUTCString()
      console.log(`[usePolling] Polling for job ${jobId?.slice(-8)} at ${now}`)
      try {
        // 创建 AbortController 用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

        const response = await fetch(`/api/generation/status?jobId=${jobId}`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId); // 清除超时定时器
        
        if (!response.ok) {
          throw new Error(`Polling failed with status: ${response.status}`)
        }
        const data = await response.json() as T;

        // 🔍 FIX: 简单的数据变化检测，减少不必要的更新
        const dataString = JSON.stringify(data);
        const lastDataString = lastDataRef.current ? JSON.stringify(lastDataRef.current) : null;

        if (dataString !== lastDataString) {
          console.log(`[usePolling] 📡 Data changed, triggering update for job ${jobId?.slice(-8)}`);
          lastDataRef.current = data;
          onUpdate(data);
        } else {
          // 数据没有变化，不触发更新
          console.log(`[usePolling] 📡 No data change detected for job ${jobId?.slice(-8)}`);
        }

        // Reset fail counter on success
        setConsecutiveFails(0);
        stopPolling();
      } catch (error) {
        // 解决异步 useState 问题
        const newFailCount = pollingNumber.current + 1;
        pollingNumber.current = newFailCount;
        setConsecutiveFails(pollingNumber.current);
          console.warn(`[usePolling] Poll failed for job ${jobId?.slice(-8)}. Consecutive fails: ${newFailCount}`);

        if (newFailCount >= MAX_CONSECUTIVE_FAILS) {
          console.error(`[usePolling] Reached max consecutive fails (${MAX_CONSECUTIVE_FAILS}). Stopping polling.`);
          onPollingError?.(error instanceof Error ? error : new Error("Unknown polling error"));
          stopPolling();
        }else{
          pollingIntervalIdRef.current = setTimeout(poll, 1000)
        }
      }
    }

    setConsecutiveFails(0);
    console.log(`[usePolling] Starting polling for jobId: ${jobId}`)
    pollingIntervalIdRef.current = setTimeout(poll, 1000) // Initial poll
    

    // // Cleanup function
    // return () => {
    //   stopPolling()
    // }
  }, [jobId, isPolling])

  const startPolling = useCallback(() => {
    if (!jobId || isPolling) return;
    setIsPolling(true);
    setConsecutiveFails(0);
  }, [jobId, isPolling]);

  // auto start polling
  useEffect(() => {
    if (!jobId || isPolling) return;
    setIsPolling(true);
    setConsecutiveFails(0);
  }, [jobId]);



  return { isPolling, startPolling, stopPolling }
}