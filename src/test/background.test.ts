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

const mockNotifications = {
  create: vi.fn(async () => 'pomodoro-timer-finished'),
}

const mockRuntime = {
  onMessage: {
    addListener: vi.fn(),
  },
}

// Install global chrome mock before module import
vi.stubGlobal('chrome', {
  storage: mockStorage,
  alarms: mockAlarms,
  notifications: mockNotifications,
  runtime: mockRuntime,
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
  restoreTimerState,
  showTimerNotification,
  handleMessage,
} = await import('../background/index')

// Capture addListener call info immediately after import, before any
// beforeEach can clear the mock call history.
const addListenerCalledAfterImport = mockAlarms.onAlarm.addListener.mock.calls.length > 0
const addListenerCallArgs = [...mockAlarms.onAlarm.addListener.mock.calls]
const onMessageListenerCalledAfterImport = mockRuntime.onMessage.addListener.mock.calls.length > 0
const onMessageListenerCallArgs = [...mockRuntime.onMessage.addListener.mock.calls]

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

    it('triggers a notification when timer finishes', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 30,
        startTime: Date.now() - 60 * 1000, // started 60s ago, only 30s left
      }

      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      expect(mockNotifications.create).toHaveBeenCalledTimes(1)
    })

    it('sends work-mode notification when work timer finishes', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        mode: 'work',
        isRunning: true,
        timeLeft: 10,
        startTime: Date.now() - 20 * 1000,
      }

      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ title: 'Work session complete!' })
      )
    })

    it('sends break-mode notification when break timer finishes', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        mode: 'break',
        isRunning: true,
        timeLeft: 10,
        startTime: Date.now() - 20 * 1000,
      }

      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ title: 'Break is over!' })
      )
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
    it('does not trigger a notification when timer is still running', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 10 * 60,
        startTime: Date.now() - 2 * 60 * 1000, // 2 minutes ago
      }

      await handleAlarm({ name: 'pomodoro-timer' } as chrome.alarms.Alarm)

      expect(mockNotifications.create).not.toHaveBeenCalled()
    })
  })

  // ── restoreTimerState ──────────────────────────────────────────────

  describe('restoreTimerState()', () => {
    it('exports restoreTimerState function', () => {
      expect(typeof restoreTimerState).toBe('function')
    })

    it('returns default state when storage is empty', async () => {
      const result = await restoreTimerState()
      expect(result).toEqual(DEFAULT_TIMER_STATE)
    })

    it('returns state unchanged when timer is not running', async () => {
      const stoppedState: TimerStorageState = {
        ...DEFAULT_TIMER_STATE,
        timeLeft: 10 * 60,
        isRunning: false,
        startTime: null,
      }
      storageData['timerState'] = stoppedState

      const result = await restoreTimerState()
      expect(result).toEqual(stoppedState)
      expect(mockAlarms.create).not.toHaveBeenCalled()
    })

    it('returns state unchanged when startTime is null but isRunning', async () => {
      const oddState: TimerStorageState = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        startTime: null,
      }
      storageData['timerState'] = oddState

      const result = await restoreTimerState()
      expect(result).toEqual(oddState)
      expect(mockAlarms.create).not.toHaveBeenCalled()
    })

    it('finishes timer if remaining time has elapsed while inactive', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 60,
        startTime: Date.now() - 120 * 1000, // started 2 min ago, only 1 min left
      }

      const result = await restoreTimerState()
      expect(result.isRunning).toBe(false)
      expect(result.timeLeft).toBe(0)
      expect(result.startTime).toBeNull()
    })

    it('persists finished state to storage when timer expired while inactive', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 30,
        startTime: Date.now() - 60 * 1000,
      }

      await restoreTimerState()

      const savedState = storageData['timerState'] as TimerStorageState
      expect(savedState.isRunning).toBe(false)
      expect(savedState.timeLeft).toBe(0)
    })

    it('does not create alarm when timer expired while inactive', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 10,
        startTime: Date.now() - 60 * 1000,
      }

      await restoreTimerState()
      expect(mockAlarms.create).not.toHaveBeenCalled()
    })

    it('triggers a notification when timer expired while inactive', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 30,
        startTime: Date.now() - 60 * 1000,
      }

      await restoreTimerState()
      expect(mockNotifications.create).toHaveBeenCalledTimes(1)
    })

    it('does not trigger a notification when timer is still running on restore', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 10 * 60,
        startTime: Date.now() - 2 * 60 * 1000, // 2 minutes ago, 8 min left
      }

      await restoreTimerState()
      expect(mockNotifications.create).not.toHaveBeenCalled()
    })

    it('re-creates alarm when timer is still running with remaining time', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 10 * 60,
        startTime: Date.now() - 2 * 60 * 1000, // 2 minutes ago
      }

      await restoreTimerState()
      expect(mockAlarms.create).toHaveBeenCalledWith(
        'pomodoro-timer',
        expect.objectContaining({
          periodInMinutes: 1,
        })
      )
    })

    it('updates persisted state with recalculated timeLeft', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 10 * 60,
        startTime: Date.now() - 2 * 60 * 1000, // 2 minutes ago
      }

      const result = await restoreTimerState()
      // Should be approximately 8 minutes
      expect(result.timeLeft).toBe(8 * 60)
      expect(result.isRunning).toBe(true)
    })

    it('resets startTime to current timestamp on restore', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 10 * 60,
        startTime: Date.now() - 5 * 60 * 1000, // old startTime
      }

      const before = Date.now()
      const result = await restoreTimerState()
      const after = Date.now()

      expect(result.startTime).toBeGreaterThanOrEqual(before)
      expect(result.startTime).toBeLessThanOrEqual(after)
    })

    it('sets alarm delay based on remaining time', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 10 * 60,
        startTime: Date.now() - 2 * 60 * 1000, // 8 minutes remaining
      }

      await restoreTimerState()
      expect(mockAlarms.create).toHaveBeenCalledWith(
        'pomodoro-timer',
        expect.objectContaining({
          delayInMinutes: 8, // 8 minutes remaining
        })
      )
    })

    it('persists restored state to storage', async () => {
      const originalStartTime = Date.now() - 3 * 60 * 1000
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 10 * 60,
        startTime: originalStartTime,
      }

      await restoreTimerState()

      const savedState = storageData['timerState'] as TimerStorageState
      expect(savedState.isRunning).toBe(true)
      expect(savedState.timeLeft).toBe(7 * 60) // 10 min - 3 min elapsed
      expect(savedState.startTime).not.toBe(originalStartTime) // should be reset
    })

    it('preserves timer mode during restore', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        mode: 'break',
        isRunning: true,
        timeLeft: 5 * 60,
        startTime: Date.now() - 60 * 1000, // 1 minute ago
      }

      const result = await restoreTimerState()
      expect(result.mode).toBe('break')
    })

    it('preserves duration during restore', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        duration: 50 * 60,
        isRunning: true,
        timeLeft: 40 * 60,
        startTime: Date.now() - 5 * 60 * 1000,
      }

      const result = await restoreTimerState()
      expect(result.duration).toBe(50 * 60)
    })
  })

  // ── showTimerNotification ─────────────────────────────────────────

  describe('showTimerNotification()', () => {
    it('exports showTimerNotification function', () => {
      expect(typeof showTimerNotification).toBe('function')
    })

    it('calls chrome.notifications.create', async () => {
      await showTimerNotification('work')
      expect(mockNotifications.create).toHaveBeenCalledTimes(1)
    })

    it('uses "basic" notification type', async () => {
      await showTimerNotification('work')
      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ type: 'basic' })
      )
    })

    it('includes an icon URL', async () => {
      await showTimerNotification('work')
      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ iconUrl: 'icons/icon-128.png' })
      )
    })

    it('uses a consistent notification ID', async () => {
      await showTimerNotification('work')
      expect(mockNotifications.create).toHaveBeenCalledWith(
        'pomodoro-timer-finished',
        expect.any(Object)
      )
    })

    it('shows work-session title for work mode', async () => {
      await showTimerNotification('work')
      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ title: 'Work session complete!' })
      )
    })

    it('shows break-over title for break mode', async () => {
      await showTimerNotification('break')
      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ title: 'Break is over!' })
      )
    })

    it('shows work-mode message suggesting a break', async () => {
      await showTimerNotification('work')
      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: 'Great job! Time to take a break.',
        })
      )
    })

    it('shows break-mode message suggesting focus', async () => {
      await showTimerNotification('break')
      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: 'Break finished. Ready to focus again?',
        })
      )
    })

    it('sets priority to 2 (high)', async () => {
      await showTimerNotification('work')
      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ priority: 2 })
      )
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

  it('registers a message listener on chrome.runtime.onMessage', () => {
    expect(onMessageListenerCalledAfterImport).toBe(true)
  })

  it('passes a function as the message listener', () => {
    expect(onMessageListenerCallArgs.length).toBeGreaterThan(0)
    expect(typeof onMessageListenerCallArgs[0][0]).toBe('function')
  })

  it('message listener wrapper returns true for async sendResponse', () => {
    const wrapper = onMessageListenerCallArgs[0][0]
    const result = wrapper({ type: 'GET_STATE' }, {}, vi.fn())
    expect(result).toBe(true)
  })
})

// ── handleMessage tests ─────────────────────────────────────────────

describe('Background Script – Message Handler (handleMessage)', () => {
  beforeEach(() => {
    clearStorage()
    vi.clearAllMocks()
  })

  // ── Module export ────────────────────────────────────────────────

  describe('module export', () => {
    it('exports handleMessage function', () => {
      expect(typeof handleMessage).toBe('function')
    })
  })

  // ── GET_STATE ────────────────────────────────────────────────────

  describe('GET_STATE', () => {
    it('responds with default state when storage is empty', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'GET_STATE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      expect(sendResponse).toHaveBeenCalledTimes(1)
      const { state } = sendResponse.mock.calls[0][0]
      expect(state.duration).toBe(25 * 60)
      expect(state.timeLeft).toBe(25 * 60)
      expect(state.isRunning).toBe(false)
      expect(state.mode).toBe('work')
    })

    it('returns stored state', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        duration: 50 * 60,
        timeLeft: 30 * 60,
        mode: 'break',
      }

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'GET_STATE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.duration).toBe(50 * 60)
      expect(state.mode).toBe('break')
    })

    it('recomputes timeLeft for a running timer', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 10 * 60,
        startTime: Date.now() - 3 * 60 * 1000, // 3 min elapsed
      }

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

    it('does not modify stored state', async () => {
      const original: TimerStorageState = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 10 * 60,
        startTime: Date.now() - 2 * 60 * 1000,
      }
      storageData['timerState'] = { ...original }

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'GET_STATE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      // Storage should remain unchanged (GET_STATE is read-only)
      const stored = storageData['timerState'] as TimerStorageState
      expect(stored.timeLeft).toBe(original.timeLeft)
      expect(stored.startTime).toBe(original.startTime)
    })
  })

  // ── START ────────────────────────────────────────────────────────

  describe('START', () => {
    it('starts the timer and responds with running state', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'START' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      expect(sendResponse).toHaveBeenCalledTimes(1)
      const { state } = sendResponse.mock.calls[0][0]
      expect(state.isRunning).toBe(true)
      expect(state.startTime).not.toBeNull()
    })

    it('creates a chrome alarm', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'START' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      expect(mockAlarms.create).toHaveBeenCalledWith(
        'pomodoro-timer',
        expect.objectContaining({ periodInMinutes: 1 })
      )
    })

    it('persists state to storage', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'START' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const saved = storageData['timerState'] as TimerStorageState
      expect(saved.isRunning).toBe(true)
    })
  })

  // ── PAUSE ────────────────────────────────────────────────────────

  describe('PAUSE', () => {
    it('pauses a running timer and responds with stopped state', async () => {
      // First start
      await handleMessage(
        { type: 'START' },
        {} as chrome.runtime.MessageSender,
        vi.fn()
      )

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'PAUSE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.isRunning).toBe(false)
      expect(state.startTime).toBeNull()
    })

    it('clears the chrome alarm', async () => {
      await handleMessage(
        { type: 'START' },
        {} as chrome.runtime.MessageSender,
        vi.fn()
      )

      await handleMessage(
        { type: 'PAUSE' },
        {} as chrome.runtime.MessageSender,
        vi.fn()
      )

      expect(mockAlarms.clear).toHaveBeenCalledWith('pomodoro-timer')
    })

    it('preserves remaining time', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        timeLeft: 10 * 60,
        startTime: Date.now() - 2 * 60 * 1000,
      }

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'PAUSE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.timeLeft).toBe(8 * 60)
    })
  })

  // ── RESET ────────────────────────────────────────────────────────

  describe('RESET', () => {
    it('resets timer to default duration', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        timeLeft: 5 * 60,
        isRunning: true,
        startTime: Date.now(),
      }

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'RESET' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.isRunning).toBe(false)
      expect(state.timeLeft).toBe(25 * 60)
      expect(state.startTime).toBeNull()
    })

    it('accepts a custom duration via payload', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'RESET', payload: { duration: 50 * 60 } },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.duration).toBe(50 * 60)
      expect(state.timeLeft).toBe(50 * 60)
    })

    it('clears the chrome alarm', async () => {
      await handleMessage(
        { type: 'RESET' },
        {} as chrome.runtime.MessageSender,
        vi.fn()
      )

      expect(mockAlarms.clear).toHaveBeenCalledWith('pomodoro-timer')
    })
  })

  // ── SET_MODE ─────────────────────────────────────────────────────

  describe('SET_MODE', () => {
    it('changes the timer mode to break', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'SET_MODE', payload: { mode: 'break' } },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.mode).toBe('break')
    })

    it('changes the timer mode to work', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        mode: 'break',
      }

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'SET_MODE', payload: { mode: 'work' } },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.mode).toBe('work')
    })

    it('persists mode change to storage', async () => {
      await handleMessage(
        { type: 'SET_MODE', payload: { mode: 'break' } },
        {} as chrome.runtime.MessageSender,
        vi.fn()
      )

      const saved = storageData['timerState'] as TimerStorageState
      expect(saved.mode).toBe('break')
    })

    it('preserves other state properties', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        duration: 50 * 60,
        timeLeft: 30 * 60,
      }

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'SET_MODE', payload: { mode: 'break' } },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.duration).toBe(50 * 60)
      expect(state.timeLeft).toBe(30 * 60)
    })

    it('defaults to current mode if payload.mode is undefined', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        mode: 'work',
      }

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'SET_MODE', payload: {} },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.mode).toBe('work')
    })
  })

  // ── SET_DURATION ─────────────────────────────────────────────────

  describe('SET_DURATION', () => {
    it('sets a new duration and resets timeLeft', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'SET_DURATION', payload: { duration: 15 * 60 } },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.duration).toBe(15 * 60)
      expect(state.timeLeft).toBe(15 * 60)
    })

    it('stops the timer', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        isRunning: true,
        startTime: Date.now(),
      }

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'SET_DURATION', payload: { duration: 10 * 60 } },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.isRunning).toBe(false)
      expect(state.startTime).toBeNull()
    })

    it('clears the chrome alarm', async () => {
      await handleMessage(
        { type: 'SET_DURATION', payload: { duration: 10 * 60 } },
        {} as chrome.runtime.MessageSender,
        vi.fn()
      )

      expect(mockAlarms.clear).toHaveBeenCalledWith('pomodoro-timer')
    })

    it('persists the new state to storage', async () => {
      await handleMessage(
        { type: 'SET_DURATION', payload: { duration: 45 * 60 } },
        {} as chrome.runtime.MessageSender,
        vi.fn()
      )

      const saved = storageData['timerState'] as TimerStorageState
      expect(saved.duration).toBe(45 * 60)
      expect(saved.timeLeft).toBe(45 * 60)
    })

    it('defaults to current duration if payload.duration is undefined', async () => {
      storageData['timerState'] = {
        ...DEFAULT_TIMER_STATE,
        duration: 50 * 60,
      }

      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'SET_DURATION', payload: {} },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const { state } = sendResponse.mock.calls[0][0]
      expect(state.duration).toBe(50 * 60)
      expect(state.timeLeft).toBe(50 * 60)
    })
  })

  // ── Unknown message type ─────────────────────────────────────────

  describe('unknown message type', () => {
    it('responds with current state for unknown message type', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'UNKNOWN_TYPE' as never },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      expect(sendResponse).toHaveBeenCalledTimes(1)
      const { state } = sendResponse.mock.calls[0][0]
      expect(state).toEqual(DEFAULT_TIMER_STATE)
    })
  })

  // ── sendResponse always called ───────────────────────────────────

  describe('sendResponse contract', () => {
    it('always calls sendResponse exactly once for GET_STATE', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'GET_STATE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )
      expect(sendResponse).toHaveBeenCalledTimes(1)
    })

    it('always calls sendResponse exactly once for START', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'START' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )
      expect(sendResponse).toHaveBeenCalledTimes(1)
    })

    it('always calls sendResponse exactly once for PAUSE', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'PAUSE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )
      expect(sendResponse).toHaveBeenCalledTimes(1)
    })

    it('always calls sendResponse exactly once for RESET', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'RESET' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )
      expect(sendResponse).toHaveBeenCalledTimes(1)
    })

    it('always calls sendResponse exactly once for SET_MODE', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'SET_MODE', payload: { mode: 'break' } },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )
      expect(sendResponse).toHaveBeenCalledTimes(1)
    })

    it('always calls sendResponse exactly once for SET_DURATION', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'SET_DURATION', payload: { duration: 10 * 60 } },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )
      expect(sendResponse).toHaveBeenCalledTimes(1)
    })

    it('response always contains a state property', async () => {
      const sendResponse = vi.fn()
      await handleMessage(
        { type: 'GET_STATE' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      const response = sendResponse.mock.calls[0][0]
      expect(response).toHaveProperty('state')
      expect(response.state).toHaveProperty('duration')
      expect(response.state).toHaveProperty('timeLeft')
      expect(response.state).toHaveProperty('isRunning')
      expect(response.state).toHaveProperty('startTime')
      expect(response.state).toHaveProperty('mode')
    })
  })
})
