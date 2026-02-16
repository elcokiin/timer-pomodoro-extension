/**
 * Phase 6 – Final Validation
 *
 * Verify that the timer continues to count down even when the extension
 * popup is closed.
 *
 * The Chrome Extension architecture ensures this via:
 * 1. The background service worker uses chrome.alarms (not setInterval) for
 *    timing, so countdowns survive popup close *and* service worker restarts.
 * 2. Timer state (startTime, timeLeft, isRunning) is persisted in
 *    chrome.storage.local so elapsed time can always be recomputed.
 * 3. computeTimeLeft() derives the real-time remaining from startTime,
 *    meaning any caller (popup or alarm handler) always gets the correct
 *    remaining time regardless of when they last polled.
 * 4. restoreTimerState() re-creates the alarm when the service worker
 *    restarts, so the timer never silently stops.
 * 5. handleMessage(GET_STATE) recomputes timeLeft, so re-opening the popup
 *    immediately shows the correct countdown.
 *
 * These tests simulate the key scenarios by manipulating startTime in the
 * past and verifying that the system correctly computes elapsed time.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { TimerStorageState } from '../background/index'

// ── Chrome API Mocks ──────────────────────────────────────────────────

const storageData: Record<string, unknown> = {}

const mockStorage = {
  local: {
    get: vi.fn(async (key: string) => {
      return { [key]: storageData[key] }
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(storageData, items)
    }),
  },
}

const mockAlarms = {
  create: vi.fn(async () => undefined),
  clear: vi.fn(async () => true),
  onAlarm: {
    addListener: vi.fn(),
  },
}

const mockNotifications = {
  create: vi.fn(async () => 'pomodoro-timer-finished'),
}

const mockRuntime = {
  onMessage: {
    addListener: vi.fn(),
  },
}

vi.stubGlobal('chrome', {
  storage: mockStorage,
  alarms: mockAlarms,
  notifications: mockNotifications,
  runtime: mockRuntime,
})

// ── Import module under test ──────────────────────────────────────────

const {
  DEFAULT_TIMER_STATE,
  computeTimeLeft,
  getTimerState,
  setTimerState,
  startTimer,
  handleAlarm,
  handleMessage,
  restoreTimerState,
} = await import('../background/index')

// ── Helpers ───────────────────────────────────────────────────────────

function clearStorage() {
  for (const key of Object.keys(storageData)) {
    delete storageData[key]
  }
}

/** Simulate a running timer that was started `elapsedMs` milliseconds ago. */
function seedRunningTimer(
  timeLeftAtStart: number,
  elapsedMs: number,
  overrides: Partial<TimerStorageState> = {}
): TimerStorageState {
  const state: TimerStorageState = {
    ...DEFAULT_TIMER_STATE,
    isRunning: true,
    timeLeft: timeLeftAtStart,
    startTime: Date.now() - elapsedMs,
    ...overrides,
  }
  storageData['timerState'] = state
  return state
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('Phase 6 Validation – Timer counts down while popup is closed', () => {
  beforeEach(() => {
    clearStorage()
    vi.clearAllMocks()
  })

  // ──────────────────────────────────────────────────────────────────
  // 1. computeTimeLeft correctly derives remaining time from startTime
  // ──────────────────────────────────────────────────────────────────

  describe('computeTimeLeft – real-time derivation', () => {
    it('computes correct remaining time after popup was closed for 5 minutes', () => {
      const state: TimerStorageState = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 25 * 60,       // 25 min at start
        startTime: Date.now() - 5 * 60 * 1000, // popup closed 5 min ago
      }

      expect(computeTimeLeft(state)).toBe(20 * 60) // 20 min remaining
    })

    it('computes correct remaining time after popup was closed for 10 minutes', () => {
      const state: TimerStorageState = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 25 * 60,
        startTime: Date.now() - 10 * 60 * 1000,
      }

      expect(computeTimeLeft(state)).toBe(15 * 60)
    })

    it('computes correct remaining time after popup was closed for 24 minutes', () => {
      const state: TimerStorageState = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 25 * 60,
        startTime: Date.now() - 24 * 60 * 1000,
      }

      expect(computeTimeLeft(state)).toBe(60) // 1 minute remaining
    })

    it('returns zero when the full duration has elapsed while popup was closed', () => {
      const state: TimerStorageState = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 25 * 60,
        startTime: Date.now() - 30 * 60 * 1000, // 30 min elapsed, only 25 existed
      }

      expect(computeTimeLeft(state)).toBe(0)
    })

    it('floors to zero (never negative) for large elapsed times', () => {
      const state: TimerStorageState = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 5 * 60,
        startTime: Date.now() - 60 * 60 * 1000, // 1 hour elapsed for 5-min timer
      }

      expect(computeTimeLeft(state)).toBe(0)
    })

    it('returns unchanged timeLeft when timer is paused (popup close irrelevant)', () => {
      const state: TimerStorageState = {
        ...DEFAULT_TIMER_STATE,
        isRunning: false,
        timeLeft: 15 * 60,
        startTime: null,
      }

      expect(computeTimeLeft(state)).toBe(15 * 60)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 2. GET_STATE recomputes timeLeft so the popup shows correct time
  //    when it is re-opened after being closed.
  // ──────────────────────────────────────────────────────────────────

  describe('GET_STATE – popup re-opened after being closed', () => {
    it('returns accurate timeLeft when popup re-opens after 3 minutes', async () => {
      seedRunningTimer(10 * 60, 3 * 60 * 1000) // 10 min timer, 3 min elapsed

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'GET_STATE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.timeLeft).toBe(7 * 60) // 10 - 3 = 7 min
      expect(state.isRunning).toBe(true)
    })

    it('returns accurate timeLeft when popup re-opens after 20 minutes on a 25-min timer', async () => {
      seedRunningTimer(25 * 60, 20 * 60 * 1000)

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'GET_STATE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.timeLeft).toBe(5 * 60) // 25 - 20 = 5 min
    })

    it('returns zero timeLeft when popup re-opens after the timer has fully elapsed', async () => {
      seedRunningTimer(25 * 60, 30 * 60 * 1000) // expired 5 min ago

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'GET_STATE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.timeLeft).toBe(0)
    })

    it('does not modify stored state on GET_STATE (read-only)', async () => {
      const original = seedRunningTimer(10 * 60, 2 * 60 * 1000)

      await handleMessage(
        { type: 'GET_STATE' },
        {} as chrome.runtime.MessageSender,
        vi.fn()
      )

      // Storage should be exactly as seeded (GET_STATE doesn't write)
      const stored = storageData['timerState'] as TimerStorageState
      expect(stored.timeLeft).toBe(original.timeLeft)
      expect(stored.startTime).toBe(original.startTime)
    })

    it('preserves isRunning=true when popup re-opens before timer expires', async () => {
      seedRunningTimer(25 * 60, 10 * 60 * 1000) // 15 min remaining

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'GET_STATE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.isRunning).toBe(true)
    })

    it('preserves mode when popup re-opens', async () => {
      seedRunningTimer(5 * 60, 2 * 60 * 1000, { mode: 'break', duration: 5 * 60 })

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'GET_STATE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.mode).toBe('break')
      expect(state.timeLeft).toBe(3 * 60)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 3. Alarm handler fires while popup is closed and updates storage
  // ──────────────────────────────────────────────────────────────────

  describe('handleAlarm – fires while popup is closed', () => {
    it('updates stored timeLeft when alarm fires with popup closed', async () => {
      seedRunningTimer(10 * 60, 2 * 60 * 1000) // 8 min remaining

      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      const saved = storageData['timerState'] as TimerStorageState
      expect(saved.timeLeft).toBe(8 * 60)
      expect(saved.isRunning).toBe(true)
    })

    it('finishes the timer when alarm fires and time has expired (popup closed)', async () => {
      seedRunningTimer(60, 120 * 1000) // 1 min timer, 2 min elapsed

      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      const saved = storageData['timerState'] as TimerStorageState
      expect(saved.isRunning).toBe(false)
      expect(saved.timeLeft).toBe(0)
      expect(saved.startTime).toBeNull()
    })

    it('triggers notification when timer expires while popup is closed', async () => {
      seedRunningTimer(60, 120 * 1000) // expired

      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      expect(mockNotifications.create).toHaveBeenCalledTimes(1)
    })

    it('clears the alarm when timer expires while popup is closed', async () => {
      seedRunningTimer(60, 120 * 1000)

      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      expect(mockAlarms.clear).toHaveBeenCalledWith('pomodoro-timer')
    })

    it('does not clear alarm when timer is still running (mid-countdown)', async () => {
      seedRunningTimer(10 * 60, 2 * 60 * 1000) // 8 min remaining

      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      expect(mockAlarms.clear).not.toHaveBeenCalled()
    })

    it('resets startTime to now when timer is still running (allows next computation)', async () => {
      seedRunningTimer(10 * 60, 2 * 60 * 1000)

      const before = Date.now()
      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)
      const after = Date.now()

      const saved = storageData['timerState'] as TimerStorageState
      expect(saved.startTime).toBeGreaterThanOrEqual(before)
      expect(saved.startTime).toBeLessThanOrEqual(after)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 4. Service worker restart – restoreTimerState re-creates the alarm
  // ──────────────────────────────────────────────────────────────────

  describe('restoreTimerState – service worker restart while popup is closed', () => {
    it('re-creates alarm on service worker restart when timer is still running', async () => {
      seedRunningTimer(10 * 60, 2 * 60 * 1000) // 8 min remaining

      await restoreTimerState()

      expect(mockAlarms.create).toHaveBeenCalledWith(
        'pomodoro-timer',
        expect.objectContaining({ periodInMinutes: 1 })
      )
    })

    it('computes correct alarm delay based on remaining time', async () => {
      seedRunningTimer(10 * 60, 2 * 60 * 1000) // 8 min remaining

      await restoreTimerState()

      expect(mockAlarms.create).toHaveBeenCalledWith(
        'pomodoro-timer',
        expect.objectContaining({ delayInMinutes: 8 })
      )
    })

    it('finishes the timer if it expired during service worker downtime', async () => {
      seedRunningTimer(5 * 60, 10 * 60 * 1000) // 5 min timer, 10 min elapsed

      const result = await restoreTimerState()

      expect(result.isRunning).toBe(false)
      expect(result.timeLeft).toBe(0)
      expect(result.startTime).toBeNull()
    })

    it('sends notification if timer expired during service worker downtime', async () => {
      seedRunningTimer(5 * 60, 10 * 60 * 1000, { mode: 'work' })

      await restoreTimerState()

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ title: 'Work session complete!' })
      )
    })

    it('persists updated state so the next GET_STATE is correct', async () => {
      seedRunningTimer(10 * 60, 3 * 60 * 1000) // 7 min remaining

      await restoreTimerState()

      const saved = storageData['timerState'] as TimerStorageState
      expect(saved.timeLeft).toBe(7 * 60)
      expect(saved.isRunning).toBe(true)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 5. startTimer persists startTime so elapsed time can always be
  //    computed even after the popup is closed.
  // ──────────────────────────────────────────────────────────────────

  describe('startTimer – persists startTime for offline computation', () => {
    it('persists startTime to storage when timer starts', async () => {
      const before = Date.now()
      await startTimer()
      const after = Date.now()

      const saved = storageData['timerState'] as TimerStorageState
      expect(saved.startTime).toBeGreaterThanOrEqual(before)
      expect(saved.startTime).toBeLessThanOrEqual(after)
    })

    it('persists isRunning=true to storage when timer starts', async () => {
      await startTimer()

      const saved = storageData['timerState'] as TimerStorageState
      expect(saved.isRunning).toBe(true)
    })

    it('creates a chrome alarm that fires independently of the popup', async () => {
      await startTimer()

      expect(mockAlarms.create).toHaveBeenCalledWith(
        'pomodoro-timer',
        expect.objectContaining({
          periodInMinutes: 1,
        })
      )
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 6. End-to-end scenario: start → close popup → alarm fires →
  //    re-open popup → correct time shown
  // ──────────────────────────────────────────────────────────────────

  describe('end-to-end: start → popup closed → alarm → popup re-opened', () => {
    it('shows correct time after full lifecycle: start, popup close, alarm, popup reopen', async () => {
      // 1. Start a 25-minute timer
      const startState = await startTimer()
      expect(startState.isRunning).toBe(true)
      expect(startState.timeLeft).toBe(25 * 60)

      // 2. Simulate popup being closed and 7 minutes passing.
      //    Modify stored startTime to be 7 minutes in the past.
      const saved = storageData['timerState'] as TimerStorageState
      storageData['timerState'] = {
        ...saved,
        startTime: Date.now() - 7 * 60 * 1000,
      }

      // 3. Alarm fires while popup is closed (background is independent).
      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      // Storage should now reflect ~18 minutes remaining.
      const afterAlarm = storageData['timerState'] as TimerStorageState
      expect(afterAlarm.timeLeft).toBe(18 * 60)
      expect(afterAlarm.isRunning).toBe(true)

      // 4. User re-opens the popup → GET_STATE is sent.
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'GET_STATE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state: reopenState } = sendResponse.mock.calls[0][0]
      // timeLeft should be ≈18 minutes (the alarm just updated it and reset startTime).
      expect(reopenState.timeLeft).toBe(18 * 60)
      expect(reopenState.isRunning).toBe(true)
    })

    it('shows timer as finished after full lifecycle when timer expires while popup is closed', async () => {
      // 1. Start a 5-minute timer
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        duration: 5 * 60,
        timeLeft: 5 * 60,
      }
      await startTimer()

      // 2. Simulate 10 minutes passing (timer should have expired 5 min ago)
      const saved = storageData['timerState'] as TimerStorageState
      storageData['timerState'] = {
        ...saved,
        startTime: Date.now() - 10 * 60 * 1000,
      }

      // 3. Alarm fires
      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      // 4. User re-opens popup
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'GET_STATE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state: reopenState } = sendResponse.mock.calls[0][0]
      expect(reopenState.timeLeft).toBe(0)
      expect(reopenState.isRunning).toBe(false)
      expect(reopenState.startTime).toBeNull()
    })

    it('notifies user when timer expires while popup is closed', async () => {
      // Start a 2-minute timer
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        duration: 2 * 60,
        timeLeft: 2 * 60,
      }
      await startTimer()
      vi.clearAllMocks() // clear create calls from startTimer

      // Simulate 5 minutes passing
      const saved = storageData['timerState'] as TimerStorageState
      storageData['timerState'] = {
        ...saved,
        startTime: Date.now() - 5 * 60 * 1000,
      }

      // Alarm fires with popup closed
      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      // A notification should have been sent even though the popup is closed
      expect(mockNotifications.create).toHaveBeenCalledTimes(1)
      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ title: 'Work session complete!' })
      )
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 7. Break mode – timer also persists and counts down while popup closed
  // ──────────────────────────────────────────────────────────────────

  describe('break mode – timer persists while popup is closed', () => {
    it('computes correct remaining break time after popup was closed', () => {
      const state: TimerStorageState = {
        ...DEFAULT_TIMER_STATE,
        mode: 'break',
        duration: 5 * 60,
        isRunning: true,
        timeLeft: 5 * 60,
        startTime: Date.now() - 3 * 60 * 1000, // 3 min elapsed
      }

      expect(computeTimeLeft(state)).toBe(2 * 60)
    })

    it('sends break notification when break timer expires while popup is closed', async () => {
      seedRunningTimer(5 * 60, 10 * 60 * 1000, {
        mode: 'break',
        duration: 5 * 60,
      })

      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ title: 'Break is over!' })
      )
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 8. Storage persistence guarantees
  // ──────────────────────────────────────────────────────────────────

  describe('storage persistence guarantees', () => {
    it('timer state survives getTimerState + setTimerState round trip', async () => {
      const originalState: TimerStorageState = {
        duration: 50 * 60,
        timeLeft: 30 * 60,
        isRunning: true,
        startTime: Date.now() - 20 * 60 * 1000,
        mode: 'work',
      }

      await setTimerState(originalState)
      const retrieved = await getTimerState()

      expect(retrieved).toEqual(originalState)
    })

    it('all timer fields are persisted to chrome.storage.local', async () => {
      const state: TimerStorageState = {
        duration: 15 * 60,
        timeLeft: 8 * 60,
        isRunning: true,
        startTime: 1700000000000,
        mode: 'break',
      }

      await setTimerState(state)

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        timerState: expect.objectContaining({
          duration: 15 * 60,
          timeLeft: 8 * 60,
          isRunning: true,
          startTime: 1700000000000,
          mode: 'break',
        }),
      })
    })

    it('startTime precision is sufficient for second-level countdown accuracy', async () => {
      const before = Date.now()
      await startTimer()
      const after = Date.now()

      const saved = storageData['timerState'] as TimerStorageState
      // startTime should be a millisecond-precision timestamp
      expect(saved.startTime).toBeGreaterThanOrEqual(before)
      expect(saved.startTime).toBeLessThanOrEqual(after)
      // The difference should be negligible (< 100ms)
      expect(after - before).toBeLessThan(100)
    })
  })
})
