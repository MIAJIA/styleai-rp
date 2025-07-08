import { useState, useEffect } from "react"

export function useSessionManagement() {
  const [sessionId, setSessionId] = useState<string>("")

  useEffect(() => {
    let currentSessionId = localStorage.getItem("chat_session_id")
    if (!currentSessionId) {
      currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem("chat_session_id", currentSessionId)
    }
    setSessionId(currentSessionId)
    console.log("[useSessionManagement] Session ID initialized:", currentSessionId)
  }, [])

  return sessionId
}