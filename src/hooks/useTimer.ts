import { useState, useEffect, useCallback, useRef } from 'react'
import type { TimerStorageState, TimerMessage, TimerMessageResponse } from '../background/index'

/**
 * Default timer state used before the background responds.
 */
const DEFAULT_STATE: TimerStorageState = {
  duration: 25 * 60,
  timeLeft: 25 * 60,
  isRunning: false,
  startTime: null,
  mode: 'work',
}

/**
 * Send a typed message to the background service worker and return the
 * updated timer state.
 */
function sendTimerMessage(message: TimerMessage): Promise<TimerStorageState> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: TimerMessageResponse) => {
      resolve(response.state)
    })
  })
}

/**
 * Custom React hook that manages communication with the background
 * timer service worker.
 *
 * - Fetches the initial state on mount via GET_STATE.
 * - Polls every second while the timer is running to keep the
 *   countdown display accurate.
 * - Exposes start / pause / reset actions that delegate to the
 *   background script and update local state with the response.
 *
 * @returns { state, isLoading, start, pause, reset }
 */
export function useTimer() {
  const [state, setState] = useState<TimerStorageState>(DEFAULT_STATE)
  const [isLoading, setIsLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Polling helpers ─────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (intervalRef.current !== null) return
    intervalRef.current = setInterval(() => {
      sendTimerMessage({ type: 'GET_STATE' }).then(setState)
    }, 1000)
  }, [])

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // ── Initial load (subscribe to external system) ─────────────────

  useEffect(() => {
    let cancelled = false

    // Subscribe to background state — this is an external system read,
    // so the setState calls in the callback are valid.
    chrome.runtime.sendMessage(
      { type: 'GET_STATE' } as TimerMessage,
      (response: TimerMessageResponse) => {
        if (cancelled) return
        setState(response.state)
        setIsLoading(false)
        if (response.state.isRunning) startPolling()
      }
    )

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [startPolling, stopPolling])

  // ── Actions ─────────────────────────────────────────────────────

  const start = useCallback(async () => {
    const newState = await sendTimerMessage({ type: 'START' })
    setState(newState)
    if (newState.isRunning) startPolling()
  }, [startPolling])

  const pause = useCallback(async () => {
    const newState = await sendTimerMessage({ type: 'PAUSE' })
    setState(newState)
    stopPolling()
  }, [stopPolling])

  const reset = useCallback(async () => {
    const newState = await sendTimerMessage({ type: 'RESET' })
    setState(newState)
    stopPolling()
  }, [stopPolling])

  const setDuration = useCallback(async (durationSeconds: number) => {
    const newState = await sendTimerMessage({
      type: 'SET_DURATION',
      payload: { duration: durationSeconds },
    })
    setState(newState)
    stopPolling()
  }, [stopPolling])

  return { state, isLoading, start, pause, reset, setDuration }
}
