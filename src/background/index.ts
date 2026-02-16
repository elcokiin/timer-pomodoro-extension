/**
 * Background Service Worker for Pomodoro Task Timer
 *
 * Hosts the primary timer logic using chrome.alarms API.
 * The alarm fires every minute, and we track elapsed time against
 * a stored startTime + duration to compute time remaining.
 *
 * Exposes a chrome.runtime.onMessage listener so the popup can
 * send commands (GET_STATE, START, PAUSE, RESET, SET_MODE, SET_DURATION)
 * and receive the up-to-date TimerStorageState in the response.
 */

const ALARM_NAME = 'pomodoro-timer'
const STORAGE_KEY = 'timerState'
const NOTIFICATION_ID = 'pomodoro-timer-finished'

// ── Message Protocol ────────────────────────────────────────────────

export type MessageType =
  | 'GET_STATE'
  | 'START'
  | 'PAUSE'
  | 'RESET'
  | 'SET_MODE'
  | 'SET_DURATION'

export interface TimerMessage {
  type: MessageType
  /** Optional payload – used by RESET (custom duration) and SET_MODE */
  payload?: {
    duration?: number
    mode?: 'work' | 'break'
  }
}

export interface TimerMessageResponse {
  state: TimerStorageState
}

export interface TimerStorageState {
  /** Total duration of the timer in seconds */
  duration: number
  /** Seconds remaining on the timer */
  timeLeft: number
  /** Whether the timer is currently running */
  isRunning: boolean
  /** Timestamp (Date.now()) when the timer was started/resumed */
  startTime: number | null
  /** Timer mode: work or break */
  mode: 'work' | 'break'
}

export const DEFAULT_TIMER_STATE: TimerStorageState = {
  duration: 25 * 60,
  timeLeft: 25 * 60,
  isRunning: false,
  startTime: null,
  mode: 'work',
}

/**
 * Get the current timer state from chrome.storage.local.
 */
export async function getTimerState(): Promise<TimerStorageState> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return result[STORAGE_KEY] ?? { ...DEFAULT_TIMER_STATE }
}

/**
 * Save the timer state to chrome.storage.local.
 */
export async function setTimerState(
  state: TimerStorageState
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state })
}

/**
 * Compute real-time remaining seconds based on when the timer started
 * and how much time was left at that point.
 */
export function computeTimeLeft(state: TimerStorageState): number {
  if (!state.isRunning || state.startTime === null) {
    return state.timeLeft
  }
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000)
  return Math.max(0, state.timeLeft - elapsed)
}

/**
 * Start the timer: set isRunning, record startTime, create a chrome alarm.
 */
export async function startTimer(): Promise<TimerStorageState> {
  const state = await getTimerState()

  if (state.isRunning) return state

  if (state.timeLeft <= 0) {
    return state
  }

  const updatedState: TimerStorageState = {
    ...state,
    isRunning: true,
    startTime: Date.now(),
  }

  await setTimerState(updatedState)

  // Create an alarm that fires every minute to check timer progress.
  // We also set a precise alarm for when the timer should finish.
  const delayInMinutes = Math.max(updatedState.timeLeft / 60, 0.08)

  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes,
    periodInMinutes: 1,
  })

  return updatedState
}

/**
 * Pause the timer: compute remaining time, clear the alarm.
 */
export async function pauseTimer(): Promise<TimerStorageState> {
  const state = await getTimerState()

  if (!state.isRunning) return state

  const remaining = computeTimeLeft(state)

  const updatedState: TimerStorageState = {
    ...state,
    isRunning: false,
    timeLeft: remaining,
    startTime: null,
  }

  await setTimerState(updatedState)
  await chrome.alarms.clear(ALARM_NAME)

  return updatedState
}

/**
 * Reset the timer to defaults for the current mode.
 */
export async function resetTimer(
  duration?: number
): Promise<TimerStorageState> {
  const state = await getTimerState()
  const resetDuration = duration ?? state.duration

  const updatedState: TimerStorageState = {
    ...state,
    duration: resetDuration,
    timeLeft: resetDuration,
    isRunning: false,
    startTime: null,
  }

  await setTimerState(updatedState)
  await chrome.alarms.clear(ALARM_NAME)

  return updatedState
}

/**
 * Show a chrome.notifications alert to inform the user the timer has finished.
 */
export async function showTimerNotification(
  mode: 'work' | 'break'
): Promise<void> {
  const title =
    mode === 'work' ? 'Work session complete!' : 'Break is over!'
  const message =
    mode === 'work'
      ? 'Great job! Time to take a break.'
      : 'Break finished. Ready to focus again?'

  await chrome.notifications.create(NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title,
    message,
    priority: 2,
  })
}

/**
 * Handle alarm firing: check if timer has reached zero.
 */
export async function handleAlarm(
  alarm: chrome.alarms.Alarm
): Promise<void> {
  if (alarm.name !== ALARM_NAME) return

  const state = await getTimerState()
  if (!state.isRunning) return

  const remaining = computeTimeLeft(state)

  if (remaining <= 0) {
    // Timer finished
    const finishedState: TimerStorageState = {
      ...state,
      isRunning: false,
      timeLeft: 0,
      startTime: null,
    }

    await setTimerState(finishedState)
    await chrome.alarms.clear(ALARM_NAME)
    await showTimerNotification(state.mode)
  } else {
    // Update stored timeLeft so popup can read the latest
    const updatedState: TimerStorageState = {
      ...state,
      timeLeft: remaining,
      startTime: Date.now(),
    }
    await setTimerState(updatedState)
  }
}

/**
 * Restore timer state on service worker startup.
 *
 * Chrome can terminate the background service worker at any time.
 * When it restarts, we need to check persisted state and re-create
 * the alarm if the timer was running. This ensures the timer continues
 * counting down even after the service worker is killed and restarted.
 */
export async function restoreTimerState(): Promise<TimerStorageState> {
  const state = await getTimerState()

  if (!state.isRunning || state.startTime === null) {
    return state
  }

  const remaining = computeTimeLeft(state)

  if (remaining <= 0) {
    // Timer finished while the service worker was inactive
    const finishedState: TimerStorageState = {
      ...state,
      isRunning: false,
      timeLeft: 0,
      startTime: null,
    }
    await setTimerState(finishedState)
    await showTimerNotification(state.mode)
    return finishedState
  }

  // Update persisted timeLeft and reset startTime to now,
  // then re-create the alarm so the timer keeps running.
  const restoredState: TimerStorageState = {
    ...state,
    timeLeft: remaining,
    startTime: Date.now(),
  }
  await setTimerState(restoredState)

  const delayInMinutes = Math.max(remaining / 60, 0.08)
  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes,
    periodInMinutes: 1,
  })

  return restoredState
}

/**
 * Handle messages from the popup (or any extension page).
 *
 * The popup sends a TimerMessage and expects a TimerMessageResponse
 * containing the latest TimerStorageState. We return `true` from
 * the listener to indicate we will respond asynchronously.
 */
export async function handleMessage(
  message: TimerMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: TimerMessageResponse) => void
): Promise<void> {
  let state: TimerStorageState

  switch (message.type) {
    case 'GET_STATE': {
      const raw = await getTimerState()
      // Recompute timeLeft so the popup always gets an accurate value.
      state = {
        ...raw,
        timeLeft: computeTimeLeft(raw),
      }
      break
    }

    case 'START':
      state = await startTimer()
      break

    case 'PAUSE':
      state = await pauseTimer()
      break

    case 'RESET':
      state = await resetTimer(message.payload?.duration)
      break

    case 'SET_MODE': {
      const current = await getTimerState()
      const newMode = message.payload?.mode ?? current.mode
      state = {
        ...current,
        mode: newMode,
      }
      await setTimerState(state)
      break
    }

    case 'SET_DURATION': {
      const current = await getTimerState()
      const rawDuration = message.payload?.duration ?? current.duration
      // Guard against invalid durations (0, negative, NaN, Infinity, decimals < 1)
      const floored = Number.isFinite(rawDuration) ? Math.floor(rawDuration) : 0
      const newDuration = floored > 0 ? floored : current.duration
      state = {
        ...current,
        duration: newDuration,
        timeLeft: newDuration,
        isRunning: false,
        startTime: null,
      }
      await setTimerState(state)
      await chrome.alarms.clear(ALARM_NAME)
      break
    }

    default:
      state = await getTimerState()
      break
  }

  sendResponse({ state })
}

// ── Register listeners ─────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(handleAlarm)

// The listener must return `true` to signal an asynchronous sendResponse.
chrome.runtime.onMessage.addListener(
  (
    message: TimerMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: TimerMessageResponse) => void
  ) => {
    handleMessage(message, sender, sendResponse)
    return true // keep the message channel open for the async response
  }
)

// Restore timer state when the service worker starts up.
// This ensures persistence across service worker restarts.
restoreTimerState()
