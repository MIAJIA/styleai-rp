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
  const consecutiveFailsRef = useRef<number>(0); // Use ref instead of pollingNumber

  // 🔍 FIX: 添加上次数据的引用，避免不必要的更新
  const lastDataRef = useRef<T | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingIntervalIdRef.current) {
      clearInterval(pollingIntervalIdRef.current)
      pollingIntervalIdRef.current = null
      setIsPolling(false)
      consecutiveFailsRef.current = 0;
      console.log("[usePolling] Polling stopped.")
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      stopPolling()
      setConsecutiveFails(0);
      consecutiveFailsRef.current = 0;
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
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 10000); // 增加到10秒超时，避免过早中断

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
        consecutiveFailsRef.current = 0;
        setConsecutiveFails(0);
        
        // Schedule next poll after successful response
        pollingIntervalIdRef.current = setTimeout(poll, 2000); // 2秒间隔
      } catch (error) {
        // 增加连续失败计数
        consecutiveFailsRef.current += 1;
        setConsecutiveFails(consecutiveFailsRef.current);
        
        // 改进错误信息处理
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isAbortError = error instanceof Error && error.name === 'AbortError';
        const displayMessage = isAbortError ? 'Request timeout' : errorMessage;
        
        console.warn(`[usePolling] Poll failed for job ${jobId?.slice(-8)}. Consecutive fails: ${consecutiveFailsRef.current}. Error: ${displayMessage}`);

        if (consecutiveFailsRef.current >= MAX_CONSECUTIVE_FAILS) {
          console.error(`[usePolling] Reached max consecutive fails (${MAX_CONSECUTIVE_FAILS}). Stopping polling.`);
          const pollingError = new Error(`Opps... something went wrong. Polling failed with status: ${displayMessage}`);
          onPollingError?.(pollingError);
          stopPolling();
        } else {
          // 继续轮询，使用递增的延迟时间
          const delay = Math.min(1000 * consecutiveFailsRef.current, 5000); // 最多5秒延迟
          pollingIntervalIdRef.current = setTimeout(poll, delay);
        }
      }
    }

    consecutiveFailsRef.current = 0;
    setConsecutiveFails(0);
    console.log(`[usePolling] Starting polling for jobId: ${jobId}`)
    pollingIntervalIdRef.current = setTimeout(poll, 1000) // Initial poll
    
    // Cleanup function - 重要：确保组件卸载时清理
    return () => {
      stopPolling()
    }
  }, [jobId, isPolling, onUpdate, onPollingError, stopPolling])

  const startPolling = useCallback(() => {
    if (!jobId || isPolling) return;
    setIsPolling(true);
    consecutiveFailsRef.current = 0;
    setConsecutiveFails(0);
  }, [jobId, isPolling]);

  // auto start polling
  useEffect(() => {
    if (!jobId || isPolling) return;
    setIsPolling(true);
    consecutiveFailsRef.current = 0;
    setConsecutiveFails(0);
  }, [jobId, isPolling]);

  return { isPolling, startPolling, stopPolling }
}