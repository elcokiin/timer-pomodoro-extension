import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { TimerStorageState } from '../background/index'

// ── Chrome API Mocks ────────────────────────────────────────────────

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

// Install global chrome mock before module import
vi.stubGlobal('chrome', {
  storage: mockStorage,
  alarms: mockAlarms,
})

// ── Import module under test (after chrome mock is set up) ──────────

const {
  DEFAULT_TIMER_STATE,
  getTimerState,
  setTimerState,
  computeTimeLeft,
  startTimer,
  pauseTimer,
  resetTimer,
  handleAlarm,
} = await import('../background/index')

// Capture addListener call info immediately after import, before any
// beforeEach can clear the mock call history.
const addListenerCalledAfterImport = mockAlarms.onAlarm.addListener.mock.calls.length > 0
const addListenerCallArgs = [...mockAlarms.onAlarm.addListener.mock.calls]

// ── Helpers ─────────────────────────────────────────────────────────

function clearStorage() {
  for (const key of Object.keys(storageData)) {
    delete storageData[key]
  }
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Background Script – Timer Logic (chrome.alarms)', () => {
  beforeEach(() => {
    clearStorage()
    vi.clearAllMocks()
  })

  // ── Module structure ──────────────────────────────────────────────

  describe('module structure', () => {
    it('exports DEFAULT_TIMER_STATE', () => {
      expect(DEFAULT_TIMER_STATE).toBeDefined()
    })

    it('exports getTimerState function', () => {
      expect(typeof getTimerState).toBe('function')
    })

    it('exports setTimerState function', () => {
      expect(typeof setTimerState).toBe('function')
    })

    it('exports computeTimeLeft function', () => {
      expect(typeof computeTimeLeft).toBe('function')
    })

    it('exports startTimer function', () => {
      expect(typeof startTimer).toBe('function')
    })

    it('exports pauseTimer function', () => {
      expect(typeof pauseTimer).toBe('function')
    })

    it('exports resetTimer function', () => {
      expect(typeof resetTimer).toBe('function')
    })

    it('exports handleAlarm function', () => {
      expect(typeof handleAlarm).toBe('function')
    })
  })

  // ── DEFAULT_TIMER_STATE ───────────────────────────────────────────

  describe('DEFAULT_TIMER_STATE', () => {
    it('has a duration of 25 minutes (1500 seconds)', () => {
      expect(DEFAULT_TIMER_STATE.duration).toBe(25 * 60)
    })

    it('has timeLeft equal to duration', () => {
      expect(DEFAULT_TIMER_STATE.timeLeft).toBe(DEFAULT_TIMER_STATE.duration)
    })

    it('is not running by default', () => {
      expect(DEFAULT_TIMER_STATE.isRunning).toBe(false)
    })

    it('has null startTime by default', () => {
      expect(DEFAULT_TIMER_STATE.startTime).toBeNull()
    })

    it('defaults to work mode', () => {
      expect(DEFAULT_TIMER_STATE.mode).toBe('work')
    })
  })

  // ── getTimerState ─────────────────────────────────────────────────

  describe('getTimerState()', () => {
    it('returns default state when storage is empty', async () => {
      const state = await getTimerState()
      expect(state).toEqual(DEFAULT_TIMER_STATE)
    })

    it('reads from chrome.storage.local', async () => {
      await getTimerState()
      expect(mockStorage.local.get).toHaveBeenCalledWith('timerState')
    })

    it('returns stored state when available', async () => {
      const customState: TimerStorageState = {
        duration: 50 * 60,
        timeLeft: 30 * 60,
        isRunning: true,
        startTime: Date.now(),
        mode: 'work',
      }
      storageData['timerState'] = customState

      const state = await getTimerState()
      expect(state).toEqual(customState)
    })
  })

  // ── setTimerState ─────────────────────────────────────────────────

  describe('setTimerState()', () => {
    it('saves state to chrome.storage.local', async () => {
      const state: TimerStorageState = {
        duration: 15 * 60,
        timeLeft: 15 * 60,
        isRunning: false,
        startTime: null,
        mode: 'break',
      }

      await setTimerState(state)
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        timerState: state,
      })
    })

    it('persists state that can be retrieved', async () => {
      const state: TimerStorageState = {
        duration: 10 * 60,
        timeLeft: 5 * 60,
        isRunning: true,
        startTime: Date.now(),
        mode: 'work',
      }

      await setTimerState(state)
      const retrieved = await getTimerState()
      expect(retrieved).toEqual(state)
    })
  })

  // ── computeTimeLeft ───────────────────────────────────────────────

  describe('computeTimeLeft()', () => {
    it('returns timeLeft when timer is not running', () => {
      const state: TimerStorageState = {
        duration: 25 * 60,
        timeLeft: 10 * 60,
        isRunning: false,
        startTime: null,
        mode: 'work',
      }
      expect(computeTimeLeft(state)).toBe(10 * 60)
    })

    it('returns timeLeft when startTime is null', () => {
      const state: TimerStorageState = {
        duration: 25 * 60,
        timeLeft: 10 * 60,
        isRunning: true,
        startTime: null,
        mode: 'work',
      }
      expect(computeTimeLeft(state)).toBe(10 * 60)
    })

    it('computes remaining time based on elapsed seconds', () => {
      const now = Date.now()
      const state: TimerStorageState = {
        duration: 25 * 60,
        timeLeft: 10 * 60,
        isRunning: true,
        startTime: now - 5 * 60 * 1000, // started 5 minutes ago
        mode: 'work',
      }
      const remaining = computeTimeLeft(state)
      // Should be approximately 5 minutes (300 seconds)
      expect(remaining).toBe(5 * 60)
    })

    it('never returns below zero', () => {
      const state: TimerStorageState = {
        duration: 25 * 60,
        timeLeft: 60,
        isRunning: true,
        startTime: Date.now() - 120 * 1000, // started 2 minutes ago but only 1 min left
        mode: 'work',
      }
      expect(computeTimeLeft(state)).toBe(0)
    })
  })

  // ── startTimer ────────────────────────────────────────────────────

  describe('startTimer()', () => {
    it('sets isRunning to true', async () => {
      const result = await startTimer()
      expect(result.isRunning).toBe(true)
    })

    it('sets startTime to current timestamp', async () => {
      const before = Date.now()
      const result = await startTimer()
      const after = Date.now()
      expect(result.startTime).toBeGreaterThanOrEqual(before)
      expect(result.startTime).toBeLessThanOrEqual(after)
    })

    it('creates a chrome alarm', async () => {
      await startTimer()
      expect(mockAlarms.create).toHaveBeenCalledWith(
        'pomodoro-timer',
        expect.objectContaining({
          periodInMinutes: 1,
        })
      )
    })

    it('saves updated state to storage', async () => {
      await startTimer()
      expect(mockStorage.local.set).toHaveBeenCalled()
      const savedState = storageData['timerState'] as TimerStorageState
      expect(savedState.isRunning).toBe(true)
    })

    it('does not restart if already running', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        startTime: Date.now() - 60000,
      }
      const originalStartTime = (storageData['timerState'] as TimerStorageState).startTime

      const result = await startTimer()
      expect(result.startTime).toBe(originalStartTime)
    })

    it('does not start if timeLeft is zero', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        timeLeft: 0,
      }

      const result = await startTimer()
      expect(result.isRunning).toBe(false)
      expect(mockAlarms.create).not.toHaveBeenCalled()
    })

    it('sets alarm delay based on timeLeft', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        timeLeft: 5 * 60, // 5 minutes
      }

      await startTimer()
      expect(mockAlarms.create).toHaveBeenCalledWith(
        'pomodoro-timer',
        expect.objectContaining({
          delayInMinutes: 5,
        })
      )
    })
  })

  // ── pauseTimer ────────────────────────────────────────────────────

  describe('pauseTimer()', () => {
    it('sets isRunning to false', async () => {
      // First start the timer
      await startTimer()
      const result = await pauseTimer()
      expect(result.isRunning).toBe(false)
    })

    it('clears the chrome alarm', async () => {
      await startTimer()
      await pauseTimer()
      expect(mockAlarms.clear).toHaveBeenCalledWith('pomodoro-timer')
    })

    it('sets startTime to null', async () => {
      await startTimer()
      const result = await pauseTimer()
      expect(result.startTime).toBeNull()
    })

    it('preserves remaining time', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 10 * 60,
        startTime: Date.now() - 2 * 60 * 1000, // 2 minutes ago
      }

      const result = await pauseTimer()
      // Should be approximately 8 minutes
      expect(result.timeLeft).toBe(8 * 60)
    })

    it('does nothing if timer is not running', async () => {
      const result = await pauseTimer()
      expect(result.isRunning).toBe(false)
      expect(mockAlarms.clear).not.toHaveBeenCalled()
    })
  })

  // ── resetTimer ────────────────────────────────────────────────────

  describe('resetTimer()', () => {
    it('sets isRunning to false', async () => {
      await startTimer()
      const result = await resetTimer()
      expect(result.isRunning).toBe(false)
    })

    it('resets timeLeft to duration', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        timeLeft: 5 * 60, // partially elapsed
      }

      const result = await resetTimer()
      expect(result.timeLeft).toBe(25 * 60)
    })

    it('clears the chrome alarm', async () => {
      await resetTimer()
      expect(mockAlarms.clear).toHaveBeenCalledWith('pomodoro-timer')
    })

    it('sets startTime to null', async () => {
      await startTimer()
      const result = await resetTimer()
      expect(result.startTime).toBeNull()
    })

    it('accepts a custom duration', async () => {
      const customDuration = 50 * 60
      const result = await resetTimer(customDuration)
      expect(result.duration).toBe(customDuration)
      expect(result.timeLeft).toBe(customDuration)
    })

    it('uses current duration if no custom duration provided', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        duration: 15 * 60,
        timeLeft: 3 * 60,
      }

      const result = await resetTimer()
      expect(result.duration).toBe(15 * 60)
      expect(result.timeLeft).toBe(15 * 60)
    })
  })

  // ── handleAlarm ───────────────────────────────────────────────────

  describe('handleAlarm()', () => {
    it('ignores alarms with a different name', async () => {
      await handleAlarm({ name: 'some-other-alarm' } as chrome.alarms.Alarm)
      expect(mockStorage.local.get).not.toHaveBeenCalled()
    })

    it('does nothing if timer is not running', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: false,
      }

      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)
      expect(mockAlarms.clear).not.toHaveBeenCalled()
    })

    it('finishes the timer when time reaches zero', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 30,
        startTime: Date.now() - 60 * 1000, // started 60s ago, only 30s left
      }

      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      const finalState = storageData['timerState'] as TimerStorageState
      expect(finalState.isRunning).toBe(false)
      expect(finalState.timeLeft).toBe(0)
      expect(finalState.startTime).toBeNull()
    })

    it('clears the alarm when timer finishes', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 10,
        startTime: Date.now() - 20 * 1000,
      }

      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)
      expect(mockAlarms.clear).toHaveBeenCalledWith('pomodoro-timer')
    })

    it('updates remaining time when timer is still running', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 10 * 60,
        startTime: Date.now() - 2 * 60 * 1000, // 2 minutes ago
      }

      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      const updatedState = storageData['timerState'] as TimerStorageState
      expect(updatedState.isRunning).toBe(true)
      // Should be approximately 8 minutes
      expect(updatedState.timeLeft).toBe(8 * 60)
      // startTime should be reset to now
      expect(updatedState.startTime).not.toBeNull()
    })
  })

})

// Listener registration tests use captured call info from module import time,
// since beforeEach(vi.clearAllMocks) clears mock call history before tests run.
describe('Background Script – Listener Registration', () => {
  it('registers an alarm listener on chrome.alarms.onAlarm', () => {
    expect(addListenerCalledAfterImport).toBe(true)
  })

  it('passes a function as the alarm listener', () => {
    expect(addListenerCallArgs.length).toBeGreaterThan(0)
    expect(typeof addListenerCallArgs[0][0]).toBe('function')
  })
})
