import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import type { TimerStorageState, TimerMessage, TimerMessageResponse } from '../background/index'

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

vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: mockSendMessage,
  },
})

// ── Import modules under test (after chrome mock is set up) ─────────

const { useTimer } = await import('../hooks/useTimer')
const { TimerView } = await import('../components/TimerView')
const { RestBreakDialog } = await import('../components/RestBreakDialog')

// ── Helpers ─────────────────────────────────────────────────────────

function resetState(overrides: Partial<TimerStorageState> = {}) {
  currentState = { ...DEFAULT_STATE, ...overrides }
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
 * Configure sendMessage to track sequential message types and
 * respond with the final state after the last message.
 */
function respondToSequence(
  sequence: string[],
  finalState: TimerStorageState
) {
  const callOrder: string[] = []
  mockSendMessage.mockImplementation(
    (
      message: TimerMessage,
      callback: (response: TimerMessageResponse) => void
    ) => {
      callOrder.push(message.type)
      // After the last message in the sequence, respond with the final state
      if (message.type === sequence[sequence.length - 1]) {
        currentState = finalState
      }
      callback({ state: currentState })
    }
  )
  return callOrder
}

// ── Tests ───────────────────────────────────────────────────────────

describe('useTimer Hook – switchModeAndStart', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
    resetState()
  })

  it('exports switchModeAndStart function', async () => {
    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(typeof result.current.switchModeAndStart).toBe('function')
    unmount()
  })

  it('sends SET_MODE, SET_DURATION, and START messages in order', async () => {
    const breakState: TimerStorageState = {
      duration: 5 * 60,
      timeLeft: 5 * 60,
      isRunning: true,
      startTime: Date.now(),
      mode: 'break',
    }
    const callOrder = respondToSequence(
      ['SET_MODE', 'SET_DURATION', 'START'],
      breakState
    )

    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.switchModeAndStart('break', 5 * 60)
    })

    expect(callOrder.filter((t) => t !== 'GET_STATE')).toEqual([
      'SET_MODE',
      'SET_DURATION',
      'START',
    ])
    unmount()
  })

  it('sends SET_MODE with correct mode payload', async () => {
    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.switchModeAndStart('break', 5 * 60)
    })

    expect(mockSendMessage).toHaveBeenCalledWith(
      { type: 'SET_MODE', payload: { mode: 'break' } },
      expect.any(Function)
    )
    unmount()
  })

  it('sends SET_DURATION with correct duration payload', async () => {
    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.switchModeAndStart('break', 5 * 60)
    })

    expect(mockSendMessage).toHaveBeenCalledWith(
      { type: 'SET_DURATION', payload: { duration: 5 * 60 } },
      expect.any(Function)
    )
    unmount()
  })

  it('sends START message', async () => {
    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.switchModeAndStart('break', 5 * 60)
    })

    expect(mockSendMessage).toHaveBeenCalledWith(
      { type: 'START' },
      expect.any(Function)
    )
    unmount()
  })

  it('updates state with the final response', async () => {
    const breakState: TimerStorageState = {
      duration: 5 * 60,
      timeLeft: 5 * 60,
      isRunning: true,
      startTime: Date.now(),
      mode: 'break',
    }
    respondToSequence(['SET_MODE', 'SET_DURATION', 'START'], breakState)

    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.switchModeAndStart('break', 5 * 60)
    })

    expect(result.current.state.mode).toBe('break')
    expect(result.current.state.duration).toBe(5 * 60)
    expect(result.current.state.isRunning).toBe(true)
    unmount()
  })

  it('works for switching to work mode', async () => {
    resetState({ mode: 'break', timeLeft: 0, isRunning: false })
    const workState: TimerStorageState = {
      duration: 25 * 60,
      timeLeft: 25 * 60,
      isRunning: true,
      startTime: Date.now(),
      mode: 'work',
    }
    respondToSequence(['SET_MODE', 'SET_DURATION', 'START'], workState)

    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.switchModeAndStart('work', 25 * 60)
    })

    expect(mockSendMessage).toHaveBeenCalledWith(
      { type: 'SET_MODE', payload: { mode: 'work' } },
      expect.any(Function)
    )
    expect(result.current.state.mode).toBe('work')
    unmount()
  })
})

describe('RestBreakDialog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Rendering ─────────────────────────────────────────────────────

  it('renders when open is true', () => {
    const { unmount } = render(
      <RestBreakDialog
        open={true}
        mode="work"
        onDismiss={vi.fn()}
        onSwitchModeAndStart={vi.fn()}
      />
    )
    expect(screen.getByTestId('rest-break-dialog')).toBeInTheDocument()
    unmount()
  })

  it('does not render dialog content when open is false', () => {
    const { unmount } = render(
      <RestBreakDialog
        open={false}
        mode="work"
        onDismiss={vi.fn()}
        onSwitchModeAndStart={vi.fn()}
      />
    )
    expect(screen.queryByTestId('rest-break-dialog')).not.toBeInTheDocument()
    unmount()
  })

  // ── Work mode finished ────────────────────────────────────────────

  it('shows "Work session complete!" title when work mode finishes', () => {
    const { unmount } = render(
      <RestBreakDialog
        open={true}
        mode="work"
        onDismiss={vi.fn()}
        onSwitchModeAndStart={vi.fn()}
      />
    )
    expect(screen.getByTestId('rest-break-dialog-title')).toHaveTextContent(
      'Work session complete!'
    )
    unmount()
  })

  it('shows break prompt description when work mode finishes', () => {
    const { unmount } = render(
      <RestBreakDialog
        open={true}
        mode="work"
        onDismiss={vi.fn()}
        onSwitchModeAndStart={vi.fn()}
      />
    )
    expect(screen.getByTestId('rest-break-dialog-description')).toHaveTextContent(
      'earned a break'
    )
    unmount()
  })

  it('shows "Start Break" action button when work mode finishes', () => {
    const { unmount } = render(
      <RestBreakDialog
        open={true}
        mode="work"
        onDismiss={vi.fn()}
        onSwitchModeAndStart={vi.fn()}
      />
    )
    expect(screen.getByTestId('rest-break-dialog-action')).toHaveTextContent(
      'Start Break'
    )
    unmount()
  })

  // ── Break mode finished ───────────────────────────────────────────

  it('shows "Break is over!" title when break mode finishes', () => {
    const { unmount } = render(
      <RestBreakDialog
        open={true}
        mode="break"
        onDismiss={vi.fn()}
        onSwitchModeAndStart={vi.fn()}
      />
    )
    expect(screen.getByTestId('rest-break-dialog-title')).toHaveTextContent(
      'Break is over!'
    )
    unmount()
  })

  it('shows work prompt description when break mode finishes', () => {
    const { unmount } = render(
      <RestBreakDialog
        open={true}
        mode="break"
        onDismiss={vi.fn()}
        onSwitchModeAndStart={vi.fn()}
      />
    )
    expect(screen.getByTestId('rest-break-dialog-description')).toHaveTextContent(
      'Ready to focus again'
    )
    unmount()
  })

  it('shows "Start Work" action button when break mode finishes', () => {
    const { unmount } = render(
      <RestBreakDialog
        open={true}
        mode="break"
        onDismiss={vi.fn()}
        onSwitchModeAndStart={vi.fn()}
      />
    )
    expect(screen.getByTestId('rest-break-dialog-action')).toHaveTextContent(
      'Start Work'
    )
    unmount()
  })

  // ── Common elements ───────────────────────────────────────────────

  it('renders the icon container', () => {
    const { unmount } = render(
      <RestBreakDialog
        open={true}
        mode="work"
        onDismiss={vi.fn()}
        onSwitchModeAndStart={vi.fn()}
      />
    )
    expect(screen.getByTestId('rest-break-dialog-icon')).toBeInTheDocument()
    unmount()
  })

  it('renders the Dismiss button', () => {
    const { unmount } = render(
      <RestBreakDialog
        open={true}
        mode="work"
        onDismiss={vi.fn()}
        onSwitchModeAndStart={vi.fn()}
      />
    )
    expect(screen.getByTestId('rest-break-dialog-dismiss')).toBeInTheDocument()
    expect(screen.getByTestId('rest-break-dialog-dismiss')).toHaveTextContent('Dismiss')
    unmount()
  })

  it('renders the action button', () => {
    const { unmount } = render(
      <RestBreakDialog
        open={true}
        mode="work"
        onDismiss={vi.fn()}
        onSwitchModeAndStart={vi.fn()}
      />
    )
    expect(screen.getByTestId('rest-break-dialog-action')).toBeInTheDocument()
    unmount()
  })

  // ── Interactions ──────────────────────────────────────────────────

  it('calls onDismiss when Dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    const { unmount } = render(
      <RestBreakDialog
        open={true}
        mode="work"
        onDismiss={onDismiss}
        onSwitchModeAndStart={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('rest-break-dialog-dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('calls onSwitchModeAndStart with break mode and 5min duration when work finishes', () => {
    const onSwitchModeAndStart = vi.fn()
    const { unmount } = render(
      <RestBreakDialog
        open={true}
        mode="work"
        onDismiss={vi.fn()}
        onSwitchModeAndStart={onSwitchModeAndStart}
      />
    )
    fireEvent.click(screen.getByTestId('rest-break-dialog-action'))
    expect(onSwitchModeAndStart).toHaveBeenCalledWith('break', 5 * 60)
    unmount()
  })

  it('calls onSwitchModeAndStart with work mode and 25min duration when break finishes', () => {
    const onSwitchModeAndStart = vi.fn()
    const { unmount } = render(
      <RestBreakDialog
        open={true}
        mode="break"
        onDismiss={vi.fn()}
        onSwitchModeAndStart={onSwitchModeAndStart}
      />
    )
    fireEvent.click(screen.getByTestId('rest-break-dialog-action'))
    expect(onSwitchModeAndStart).toHaveBeenCalledWith('work', 25 * 60)
    unmount()
  })
})

describe('TimerView – Rest/Break Dialog Integration', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
    resetState()
  })

  it('shows the rest/break dialog when timer finishes (work mode)', async () => {
    // Start with a running timer
    resetState({ isRunning: true, startTime: Date.now(), timeLeft: 1 })

    const { unmount } = render(<TimerView />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })

    // Simulate timer finishing via polling
    currentState = { ...DEFAULT_STATE, timeLeft: 0, isRunning: false, mode: 'work' }
    mockSendMessage.mockImplementation(
      (_message: TimerMessage, callback: (response: TimerMessageResponse) => void) => {
        callback({ state: currentState })
      }
    )

    await waitFor(
      () => {
        expect(screen.getByTestId('rest-break-dialog')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
    unmount()
  })

  it('shows correct title for work mode completion', async () => {
    resetState({ isRunning: true, startTime: Date.now(), timeLeft: 1 })

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })

    currentState = { ...DEFAULT_STATE, timeLeft: 0, isRunning: false, mode: 'work' }
    mockSendMessage.mockImplementation(
      (_message: TimerMessage, callback: (response: TimerMessageResponse) => void) => {
        callback({ state: currentState })
      }
    )

    await waitFor(
      () => {
        expect(screen.getByTestId('rest-break-dialog-title')).toHaveTextContent(
          'Work session complete!'
        )
      },
      { timeout: 3000 }
    )
    unmount()
  })

  it('shows correct title for break mode completion', async () => {
    resetState({
      isRunning: true,
      startTime: Date.now(),
      timeLeft: 1,
      mode: 'break',
      duration: 5 * 60,
    })

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })

    currentState = {
      ...DEFAULT_STATE,
      timeLeft: 0,
      isRunning: false,
      mode: 'break',
      duration: 5 * 60,
    }
    mockSendMessage.mockImplementation(
      (_message: TimerMessage, callback: (response: TimerMessageResponse) => void) => {
        callback({ state: currentState })
      }
    )

    await waitFor(
      () => {
        expect(screen.getByTestId('rest-break-dialog-title')).toHaveTextContent(
          'Break is over!'
        )
      },
      { timeout: 3000 }
    )
    unmount()
  })

  it('dismisses dialog when Dismiss button is clicked', async () => {
    resetState({ isRunning: true, startTime: Date.now(), timeLeft: 1 })

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })

    currentState = { ...DEFAULT_STATE, timeLeft: 0, isRunning: false, mode: 'work' }
    mockSendMessage.mockImplementation(
      (_message: TimerMessage, callback: (response: TimerMessageResponse) => void) => {
        callback({ state: currentState })
      }
    )

    await waitFor(
      () => {
        expect(screen.getByTestId('rest-break-dialog')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    fireEvent.click(screen.getByTestId('rest-break-dialog-dismiss'))

    await waitFor(() => {
      expect(screen.queryByTestId('rest-break-dialog')).not.toBeInTheDocument()
    })
    unmount()
  })

  it('sends SET_MODE, SET_DURATION, START when action button is clicked (work -> break)', async () => {
    resetState({ isRunning: true, startTime: Date.now(), timeLeft: 1 })

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })

    currentState = { ...DEFAULT_STATE, timeLeft: 0, isRunning: false, mode: 'work' }
    mockSendMessage.mockImplementation(
      (_message: TimerMessage, callback: (response: TimerMessageResponse) => void) => {
        callback({ state: currentState })
      }
    )

    await waitFor(
      () => {
        expect(screen.getByTestId('rest-break-dialog')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    // Clear previous calls to track only the action button messages
    mockSendMessage.mockClear()
    mockSendMessage.mockImplementation(
      (_message: TimerMessage, callback: (response: TimerMessageResponse) => void) => {
        callback({
          state: {
            duration: 5 * 60,
            timeLeft: 5 * 60,
            isRunning: true,
            startTime: Date.now(),
            mode: 'break',
          },
        })
      }
    )

    fireEvent.click(screen.getByTestId('rest-break-dialog-action'))

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        { type: 'SET_MODE', payload: { mode: 'break' } },
        expect.any(Function)
      )
      expect(mockSendMessage).toHaveBeenCalledWith(
        { type: 'SET_DURATION', payload: { duration: 5 * 60 } },
        expect.any(Function)
      )
      expect(mockSendMessage).toHaveBeenCalledWith(
        { type: 'START' },
        expect.any(Function)
      )
    })
    unmount()
  })

  it('closes dialog after action button is clicked', async () => {
    resetState({ isRunning: true, startTime: Date.now(), timeLeft: 1 })

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })

    currentState = { ...DEFAULT_STATE, timeLeft: 0, isRunning: false, mode: 'work' }
    mockSendMessage.mockImplementation(
      (_message: TimerMessage, callback: (response: TimerMessageResponse) => void) => {
        callback({ state: currentState })
      }
    )

    await waitFor(
      () => {
        expect(screen.getByTestId('rest-break-dialog')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    // Respond with a running break state after action
    mockSendMessage.mockImplementation(
      (_message: TimerMessage, callback: (response: TimerMessageResponse) => void) => {
        callback({
          state: {
            duration: 5 * 60,
            timeLeft: 5 * 60,
            isRunning: true,
            startTime: Date.now(),
            mode: 'break',
          },
        })
      }
    )

    fireEvent.click(screen.getByTestId('rest-break-dialog-action'))

    await waitFor(() => {
      expect(screen.queryByTestId('rest-break-dialog')).not.toBeInTheDocument()
    })
    unmount()
  })

  it('does not show dialog when timer is still running', async () => {
    resetState({ isRunning: true, startTime: Date.now(), timeLeft: 500 })

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('rest-break-dialog')).not.toBeInTheDocument()
    unmount()
  })

  it('does not show dialog when timer is paused with time remaining', async () => {
    resetState({ isRunning: false, timeLeft: 500 })

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('rest-break-dialog')).not.toBeInTheDocument()
    unmount()
  })

  it('does not show dialog on initial load when timer is already finished', async () => {
    // Timer was already at zero before the popup opened
    resetState({ timeLeft: 0, isRunning: false })

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })

    // The dialog should NOT appear because the timer was already
    // at zero — it didn't "just finish". The transition didn't happen
    // while the user was watching.
    expect(screen.queryByTestId('rest-break-dialog')).not.toBeInTheDocument()
    unmount()
  })

  it('shows "Start Break" button text when work mode finishes', async () => {
    resetState({ isRunning: true, startTime: Date.now(), timeLeft: 1 })

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })

    currentState = { ...DEFAULT_STATE, timeLeft: 0, isRunning: false, mode: 'work' }
    mockSendMessage.mockImplementation(
      (_message: TimerMessage, callback: (response: TimerMessageResponse) => void) => {
        callback({ state: currentState })
      }
    )

    await waitFor(
      () => {
        expect(screen.getByTestId('rest-break-dialog-action')).toHaveTextContent(
          'Start Break'
        )
      },
      { timeout: 3000 }
    )
    unmount()
  })

  it('shows "Start Work" button text when break mode finishes', async () => {
    resetState({
      isRunning: true,
      startTime: Date.now(),
      timeLeft: 1,
      mode: 'break',
      duration: 5 * 60,
    })

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })

    currentState = {
      ...DEFAULT_STATE,
      timeLeft: 0,
      isRunning: false,
      mode: 'break',
      duration: 5 * 60,
    }
    mockSendMessage.mockImplementation(
      (_message: TimerMessage, callback: (response: TimerMessageResponse) => void) => {
        callback({ state: currentState })
      }
    )

    await waitFor(
      () => {
        expect(screen.getByTestId('rest-break-dialog-action')).toHaveTextContent(
          'Start Work'
        )
      },
      { timeout: 3000 }
    )
    unmount()
  })
})
