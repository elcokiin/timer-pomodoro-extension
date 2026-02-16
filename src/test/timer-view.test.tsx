import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import type { TimerStorageState, TimerMessage, TimerMessageResponse } from '../background/index'
import type { Task } from '../types/index'

// ── Chrome API Mocks ────────────────────────────────────────────────

const DEFAULT_STATE: TimerStorageState = {
  duration: 25 * 60,
  timeLeft: 25 * 60,
  isRunning: false,
  startTime: null,
  mode: 'work',
}

let currentState: TimerStorageState = { ...DEFAULT_STATE }

const mockSendMessage = vi.fn(
  (
    _message: TimerMessage,
    callback: (response: TimerMessageResponse) => void
  ) => {
    callback({ state: currentState })
  }
)

// ── Chrome Storage Mocks (needed by useChromeStorage in TimerView) ──

const storageData: Record<string, unknown> = {}

type StorageChangeListener = (
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string
) => void

const storageListeners: StorageChangeListener[] = []

const mockStorage = {
  local: {
    get: vi.fn(async (key: string) => {
      return { [key]: storageData[key] }
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(storageData, items)
    }),
  },
  onChanged: {
    addListener: vi.fn((listener: StorageChangeListener) => {
      storageListeners.push(listener)
    }),
    removeListener: vi.fn((listener: StorageChangeListener) => {
      const index = storageListeners.indexOf(listener)
      if (index !== -1) storageListeners.splice(index, 1)
    }),
  },
}

vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: mockSendMessage,
  },
  storage: mockStorage,
})

// ── Import modules under test (after chrome mock is set up) ─────────

const { useTimer } = await import('../hooks/useTimer')
const { TimerView } = await import('../components/TimerView')

// ── Helpers ─────────────────────────────────────────────────────────

function resetState(overrides: Partial<TimerStorageState> = {}) {
  currentState = { ...DEFAULT_STATE, ...overrides }
  // Clear tasks storage
  for (const key of Object.keys(storageData)) {
    delete storageData[key]
  }
  storageListeners.length = 0
  // Also reset the mock implementation to use the new currentState
  mockSendMessage.mockImplementation(
    (
      _message: TimerMessage,
      callback: (response: TimerMessageResponse) => void
    ) => {
      callback({ state: currentState })
    }
  )
}

/**
 * Configure sendMessage to respond with a specific state for a given
 * message type, then return the default for all others.
 */
function respondWith(
  type: string,
  state: TimerStorageState
) {
  mockSendMessage.mockImplementation(
    (
      message: TimerMessage,
      callback: (response: TimerMessageResponse) => void
    ) => {
      if (message.type === type) {
        currentState = state
        callback({ state })
      } else {
        callback({ state: currentState })
      }
    }
  )
}

// ── Tests ───────────────────────────────────────────────────────────

describe('useTimer Hook', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
    resetState() // re-install mock after clearAllMocks
  })

  // ── Module export ─────────────────────────────────────────────────

  it('exports useTimer function', () => {
    expect(typeof useTimer).toBe('function')
  })

  // ── Initial state ─────────────────────────────────────────────────

  it('sends GET_STATE on mount', async () => {
    const { unmount } = renderHook(() => useTimer())
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        { type: 'GET_STATE' },
        expect.any(Function)
      )
    })
    unmount()
  })

  it('returns the timer state from background', async () => {
    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.state.timeLeft).toBe(25 * 60)
    expect(result.current.state.isRunning).toBe(false)
    expect(result.current.state.mode).toBe('work')
    unmount()
  })

  it('sets isLoading to false after initial fetch', async () => {
    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    unmount()
  })

  // ── Start action ──────────────────────────────────────────────────

  it('sends START message when start() is called', async () => {
    const runningState: TimerStorageState = {
      ...DEFAULT_STATE,
      isRunning: true,
      startTime: Date.now(),
    }
    respondWith('START', runningState)

    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.start()
    })

    expect(mockSendMessage).toHaveBeenCalledWith(
      { type: 'START' },
      expect.any(Function)
    )
    unmount()
  })

  it('updates state after start()', async () => {
    const runningState: TimerStorageState = {
      ...DEFAULT_STATE,
      isRunning: true,
      startTime: Date.now(),
    }
    respondWith('START', runningState)

    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.start()
    })

    expect(result.current.state.isRunning).toBe(true)
    unmount()
  })

  // ── Pause action ──────────────────────────────────────────────────

  it('sends PAUSE message when pause() is called', async () => {
    const pausedState: TimerStorageState = {
      ...DEFAULT_STATE,
      isRunning: false,
      timeLeft: 24 * 60,
      startTime: null,
    }
    respondWith('PAUSE', pausedState)

    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.pause()
    })

    expect(mockSendMessage).toHaveBeenCalledWith(
      { type: 'PAUSE' },
      expect.any(Function)
    )
    unmount()
  })

  it('updates state after pause()', async () => {
    resetState({ isRunning: true, startTime: Date.now() })
    const pausedState: TimerStorageState = {
      ...DEFAULT_STATE,
      isRunning: false,
      timeLeft: 24 * 60,
      startTime: null,
    }
    respondWith('PAUSE', pausedState)

    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.pause()
    })

    expect(result.current.state.isRunning).toBe(false)
    expect(result.current.state.timeLeft).toBe(24 * 60)
    unmount()
  })

  // ── Reset action ──────────────────────────────────────────────────

  it('sends RESET message when reset() is called', async () => {
    respondWith('RESET', { ...DEFAULT_STATE })

    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.reset()
    })

    expect(mockSendMessage).toHaveBeenCalledWith(
      { type: 'RESET' },
      expect.any(Function)
    )
    unmount()
  })

  it('updates state after reset()', async () => {
    resetState({ isRunning: true, timeLeft: 100, startTime: Date.now() })
    respondWith('RESET', { ...DEFAULT_STATE })

    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.reset()
    })

    expect(result.current.state.isRunning).toBe(false)
    expect(result.current.state.timeLeft).toBe(25 * 60)
    unmount()
  })

  // ── Cleanup ───────────────────────────────────────────────────────

  it('stops polling on unmount', async () => {
    resetState({ isRunning: true, startTime: Date.now() })

    const { unmount } = renderHook(() => useTimer())
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalled()
    })

    unmount()
    const callsAfterUnmount = mockSendMessage.mock.calls.length

    // Wait a bit to see if any more calls come in
    await new Promise((resolve) => setTimeout(resolve, 1500))

    expect(mockSendMessage.mock.calls.length).toBe(callsAfterUnmount)
  })

  // ── Return shape ──────────────────────────────────────────────────

  it('returns state, isLoading, start, pause, reset', async () => {
    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current).toHaveProperty('state')
    expect(result.current).toHaveProperty('isLoading')
    expect(typeof result.current.start).toBe('function')
    expect(typeof result.current.pause).toBe('function')
    expect(typeof result.current.reset).toBe('function')
    unmount()
  })
})

describe('TimerView Component', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
    resetState() // re-install mock after clearAllMocks
  })

  // ── Rendering ─────────────────────────────────────────────────────

  it('renders the timer view container', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })
    unmount()
  })

  it('displays the countdown in MM:SS format', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-display')).toHaveTextContent('25:00')
    })
    unmount()
  })

  it('displays the mode label', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-mode')).toHaveTextContent('Work')
    })
    unmount()
  })

  it('displays break mode label when in break mode', async () => {
    resetState({ mode: 'break' })
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-mode')).toHaveTextContent('Break')
    })
    unmount()
  })

  it('renders the progress bar', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-progress')).toBeInTheDocument()
    })
    unmount()
  })

  it('renders the controls container', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-controls')).toBeInTheDocument()
    })
    unmount()
  })

  // ── Timer display formatting ──────────────────────────────────────

  it('formats single-digit seconds with leading zero', async () => {
    resetState({ timeLeft: 65 }) // 1:05
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-display')).toHaveTextContent('01:05')
    })
    unmount()
  })

  it('formats single-digit minutes with leading zero', async () => {
    resetState({ timeLeft: 5 * 60 + 30 }) // 5:30
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-display')).toHaveTextContent('05:30')
    })
    unmount()
  })

  it('displays 00:00 when timer is at zero', async () => {
    resetState({ timeLeft: 0 })
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-display')).toHaveTextContent('00:00')
    })
    unmount()
  })

  it('displays large durations correctly', async () => {
    resetState({ timeLeft: 50 * 60 }) // 50:00
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-display')).toHaveTextContent('50:00')
    })
    unmount()
  })

  // ── Buttons: idle state ───────────────────────────────────────────

  it('shows Start button when timer is not running', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-start-button')).toBeInTheDocument()
    })
    unmount()
  })

  it('shows Reset button', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-reset-button')).toBeInTheDocument()
    })
    unmount()
  })

  it('does not show Pause button when timer is idle', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-start-button')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('timer-pause-button')).not.toBeInTheDocument()
    unmount()
  })

  // ── Buttons: running state ────────────────────────────────────────

  it('shows Pause button when timer is running', async () => {
    resetState({ isRunning: true, startTime: Date.now() })
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-pause-button')).toBeInTheDocument()
    })
    unmount()
  })

  it('does not show Start button when timer is running', async () => {
    resetState({ isRunning: true, startTime: Date.now() })
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-pause-button')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('timer-start-button')).not.toBeInTheDocument()
    unmount()
  })

  // ── Buttons: finished state ───────────────────────────────────────

  it('disables Start button when timer is at zero', async () => {
    resetState({ timeLeft: 0, isRunning: false })
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-start-button')).toBeDisabled()
    })
    unmount()
  })

  // ── Button interactions ───────────────────────────────────────────

  it('sends START when Start button is clicked', async () => {
    const runningState: TimerStorageState = {
      ...DEFAULT_STATE,
      isRunning: true,
      startTime: Date.now(),
    }
    respondWith('START', runningState)

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-start-button')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('timer-start-button'))

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        { type: 'START' },
        expect.any(Function)
      )
    })
    unmount()
  })

  it('sends PAUSE when Pause button is clicked', async () => {
    resetState({ isRunning: true, startTime: Date.now() })
    const pausedState: TimerStorageState = {
      ...DEFAULT_STATE,
      isRunning: false,
      startTime: null,
    }
    respondWith('PAUSE', pausedState)

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-pause-button')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('timer-pause-button'))

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        { type: 'PAUSE' },
        expect.any(Function)
      )
    })
    unmount()
  })

  it('sends RESET when Reset button is clicked', async () => {
    respondWith('RESET', { ...DEFAULT_STATE })

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-reset-button')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('timer-reset-button'))

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        { type: 'RESET' },
        expect.any(Function)
      )
    })
    unmount()
  })

  it('switches to Pause button after Start is clicked', async () => {
    const runningState: TimerStorageState = {
      ...DEFAULT_STATE,
      isRunning: true,
      startTime: Date.now(),
    }
    respondWith('START', runningState)

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-start-button')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('timer-start-button'))

    await waitFor(() => {
      expect(screen.getByTestId('timer-pause-button')).toBeInTheDocument()
    })
    unmount()
  })

  it('switches to Start button after Pause is clicked', async () => {
    resetState({ isRunning: true, startTime: Date.now() })
    const pausedState: TimerStorageState = {
      ...DEFAULT_STATE,
      isRunning: false,
      timeLeft: 24 * 60,
      startTime: null,
    }
    respondWith('PAUSE', pausedState)

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-pause-button')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('timer-pause-button'))

    await waitFor(() => {
      expect(screen.getByTestId('timer-start-button')).toBeInTheDocument()
    })
    unmount()
  })

  // ── Button text labels ────────────────────────────────────────────

  it('Start button has text "Start"', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-start-button')).toHaveTextContent('Start')
    })
    unmount()
  })

  it('Pause button has text "Pause"', async () => {
    resetState({ isRunning: true, startTime: Date.now() })
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-pause-button')).toHaveTextContent('Pause')
    })
    unmount()
  })

  it('Reset button has text "Reset"', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-reset-button')).toHaveTextContent('Reset')
    })
    unmount()
  })

  // ── Loading state ─────────────────────────────────────────────────

  it('shows loading indicator initially', () => {
    // Override sendMessage to not call the callback (simulate async loading)
    mockSendMessage.mockImplementation(() => {
      // Do nothing — never resolve
    })
    const { unmount } = render(<TimerView />)
    expect(screen.getByTestId('timer-loading')).toBeInTheDocument()
    unmount()
  })

  it('loading indicator contains "Loading" text', () => {
    mockSendMessage.mockImplementation(() => {})
    const { unmount } = render(<TimerView />)
    expect(screen.getByTestId('timer-loading')).toHaveTextContent('Loading')
    unmount()
  })
})

// ═════════════════════════════════════════════════════════════════════
//  Active Task Display
// ═════════════════════════════════════════════════════════════════════

function seedTasks(tasks: Task[]) {
  storageData['tasks'] = tasks
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: Date.now().toString(),
    text: 'My Task',
    completed: false,
    isSelected: false,
    ...overrides,
  }
}

describe('TimerView – Active Task Display', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
    resetState()
  })

  it('does not show active task display when no tasks exist', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('active-task-display')).not.toBeInTheDocument()
    unmount()
  })

  it('does not show active task display when no task is selected', async () => {
    seedTasks([makeTask({ id: '1', text: 'Unselected task', isSelected: false })])
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('active-task-display')).not.toBeInTheDocument()
    unmount()
  })

  it('shows active task display when a task is selected', async () => {
    seedTasks([makeTask({ id: '1', text: 'Write report', isSelected: true })])
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('active-task-display')).toBeInTheDocument()
    })
    unmount()
  })

  it('displays the selected task text', async () => {
    seedTasks([makeTask({ id: '1', text: 'Write report', isSelected: true })])
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('active-task-display')).toHaveTextContent('Write report')
    })
    unmount()
  })

  it('only displays the selected task when multiple tasks exist', async () => {
    seedTasks([
      makeTask({ id: '1', text: 'Task A', isSelected: false }),
      makeTask({ id: '2', text: 'Task B', isSelected: true }),
      makeTask({ id: '3', text: 'Task C', isSelected: false }),
    ])
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('active-task-display')).toHaveTextContent('Task B')
    })
    unmount()
  })

  it('has a title attribute for tooltip on long task names', async () => {
    const longText = 'This is a very long task name that should be truncated in the UI display'
    seedTasks([makeTask({ id: '1', text: longText, isSelected: true })])
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      const el = screen.getByTestId('active-task-display')
      expect(el).toHaveAttribute('title', longText)
    })
    unmount()
  })

  it('active task display appears between mode badge and countdown', async () => {
    seedTasks([makeTask({ id: '1', text: 'My active task', isSelected: true })])
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('active-task-display')).toBeInTheDocument()
    })

    // Verify ordering: mode badge, then active task, then countdown
    const timerView = screen.getByTestId('timer-view')
    const modeBadge = screen.getByTestId('timer-mode')
    const activeTask = screen.getByTestId('active-task-display')
    const countdown = screen.getByTestId('timer-display')

    const children = Array.from(timerView.children)
    const modeIdx = children.indexOf(modeBadge)
    const activeIdx = children.indexOf(activeTask)
    const countdownIdx = children.indexOf(countdown)

    expect(modeIdx).toBeLessThan(activeIdx)
    expect(activeIdx).toBeLessThan(countdownIdx)
    unmount()
  })

  it('does not show active task for a completed selected task', async () => {
    // A completed task that is also selected should still be shown
    // (the user may want to see what they completed while timing)
    seedTasks([makeTask({ id: '1', text: 'Finished task', isSelected: true, completed: true })])
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('active-task-display')).toHaveTextContent('Finished task')
    })
    unmount()
  })

  it('does not show active task display with empty tasks array', async () => {
    seedTasks([])
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('active-task-display')).not.toBeInTheDocument()
    unmount()
  })
})
