import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import type { TimerStorageState, TimerMessage, TimerMessageResponse } from '../background/index'

// ══════════════════════════════════════════════════════════════════════
// Part 1: Background Script – SET_DURATION edge case validation
// ══════════════════════════════════════════════════════════════════════

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
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
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
  sendMessage: vi.fn(),
}

vi.stubGlobal('chrome', {
  storage: mockStorage,
  alarms: mockAlarms,
  notifications: mockNotifications,
  runtime: mockRuntime,
})

// Import background module
const { handleMessage, DEFAULT_TIMER_STATE } = await import('../background/index')

// Import UI modules
const { useTimer } = await import('../hooks/useTimer')
const { PresetsSection } = await import('../components/PresetsSection')
const { TimerView } = await import('../components/TimerView')

// ── Helpers ─────────────────────────────────────────────────────────

function clearStorage() {
  for (const key of Object.keys(storageData)) {
    delete storageData[key]
  }
}

function seedState(state: TimerStorageState) {
  storageData['timerState'] = { ...state }
}

function getStoredState(): TimerStorageState {
  return storageData['timerState'] as TimerStorageState
}

async function sendSetDuration(
  duration: number | undefined,
  initialState?: Partial<TimerStorageState>
): Promise<TimerStorageState> {
  if (initialState) {
    seedState({ ...DEFAULT_TIMER_STATE, ...initialState })
  } else {
    seedState({ ...DEFAULT_TIMER_STATE })
  }

  let result!: TimerStorageState
  const sendResponse = (response: TimerMessageResponse) => {
    result = response.state
  }

  await handleMessage(
    { type: 'SET_DURATION', payload: { duration } } as TimerMessage,
    {} as chrome.runtime.MessageSender,
    sendResponse
  )

  return result
}

// UI test helpers
const UI_DEFAULT: TimerStorageState = {
  duration: 25 * 60,
  timeLeft: 25 * 60,
  isRunning: false,
  startTime: null,
  mode: 'work',
}

let uiState: TimerStorageState = { ...UI_DEFAULT }

function resetUiMock(overrides: Partial<TimerStorageState> = {}) {
  uiState = { ...UI_DEFAULT, ...overrides }
  mockRuntime.sendMessage.mockImplementation(
    (_message: TimerMessage, callback: (response: TimerMessageResponse) => void) => {
      callback({ state: uiState })
    }
  )
}

// ══════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════

describe('Background Script – SET_DURATION edge case validation', () => {
  beforeEach(() => {
    clearStorage()
    vi.clearAllMocks()
  })

  it('rejects zero duration and keeps current duration', async () => {
    const result = await sendSetDuration(0, { duration: 25 * 60, timeLeft: 25 * 60 })
    expect(result.duration).toBe(25 * 60)
    expect(result.timeLeft).toBe(25 * 60)
  })

  it('rejects negative duration and keeps current duration', async () => {
    const result = await sendSetDuration(-5 * 60, { duration: 25 * 60, timeLeft: 25 * 60 })
    expect(result.duration).toBe(25 * 60)
    expect(result.timeLeft).toBe(25 * 60)
  })

  it('rejects large negative duration', async () => {
    const result = await sendSetDuration(-9999, { duration: 50 * 60, timeLeft: 50 * 60 })
    expect(result.duration).toBe(50 * 60)
    expect(result.timeLeft).toBe(50 * 60)
  })

  it('rejects NaN duration and keeps current duration', async () => {
    const result = await sendSetDuration(NaN, { duration: 15 * 60, timeLeft: 15 * 60 })
    expect(result.duration).toBe(15 * 60)
    expect(result.timeLeft).toBe(15 * 60)
  })

  it('rejects Infinity duration and keeps current duration', async () => {
    const result = await sendSetDuration(Infinity, { duration: 25 * 60, timeLeft: 25 * 60 })
    expect(result.duration).toBe(25 * 60)
    expect(result.timeLeft).toBe(25 * 60)
  })

  it('rejects -Infinity duration and keeps current duration', async () => {
    const result = await sendSetDuration(-Infinity, { duration: 25 * 60, timeLeft: 25 * 60 })
    expect(result.duration).toBe(25 * 60)
    expect(result.timeLeft).toBe(25 * 60)
  })

  it('accepts valid positive duration', async () => {
    const result = await sendSetDuration(10 * 60, { duration: 25 * 60, timeLeft: 25 * 60 })
    expect(result.duration).toBe(10 * 60)
    expect(result.timeLeft).toBe(10 * 60)
  })

  it('accepts 1 second as minimum valid duration', async () => {
    const result = await sendSetDuration(1)
    expect(result.duration).toBe(1)
    expect(result.timeLeft).toBe(1)
  })

  it('floors decimal durations', async () => {
    const result = await sendSetDuration(90.7)
    expect(result.duration).toBe(90)
    expect(result.timeLeft).toBe(90)
  })

  it('floors very small positive decimals to 0 and falls back to current duration', async () => {
    // 0.3 floors to 0, which is <= 0, so it should be rejected
    const result = await sendSetDuration(0.3, { duration: 25 * 60, timeLeft: 25 * 60 })
    expect(result.duration).toBe(25 * 60)
    expect(result.timeLeft).toBe(25 * 60)
  })

  it('stops timer and clears alarm even for invalid duration', async () => {
    const result = await sendSetDuration(0, {
      duration: 25 * 60,
      timeLeft: 20 * 60,
      isRunning: true,
      startTime: Date.now(),
    })
    expect(result.isRunning).toBe(false)
    expect(result.startTime).toBeNull()
    expect(mockAlarms.clear).toHaveBeenCalled()
  })

  it('persists state to storage for invalid duration (with fallback)', async () => {
    await sendSetDuration(-10, { duration: 25 * 60, timeLeft: 25 * 60 })
    const stored = getStoredState()
    expect(stored.duration).toBe(25 * 60)
    expect(stored.timeLeft).toBe(25 * 60)
  })

  it('accepts large valid duration', async () => {
    const result = await sendSetDuration(120 * 60) // 2 hours
    expect(result.duration).toBe(120 * 60)
    expect(result.timeLeft).toBe(120 * 60)
  })
})

describe('useTimer Hook – setDuration edge case validation', () => {
  beforeEach(() => {
    resetUiMock()
    vi.clearAllMocks()
    resetUiMock()
  })

  it('does not send message for zero duration', async () => {
    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.setDuration(0)
    })

    // Should not have sent SET_DURATION (only GET_STATE for initial load)
    const setDurationCalls = mockRuntime.sendMessage.mock.calls.filter(
      (call: [TimerMessage, unknown]) => call[0].type === 'SET_DURATION'
    )
    expect(setDurationCalls).toHaveLength(0)
    unmount()
  })

  it('does not send message for negative duration', async () => {
    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.setDuration(-300)
    })

    const setDurationCalls = mockRuntime.sendMessage.mock.calls.filter(
      (call: [TimerMessage, unknown]) => call[0].type === 'SET_DURATION'
    )
    expect(setDurationCalls).toHaveLength(0)
    unmount()
  })

  it('does not send message for NaN duration', async () => {
    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.setDuration(NaN)
    })

    const setDurationCalls = mockRuntime.sendMessage.mock.calls.filter(
      (call: [TimerMessage, unknown]) => call[0].type === 'SET_DURATION'
    )
    expect(setDurationCalls).toHaveLength(0)
    unmount()
  })

  it('does not send message for Infinity duration', async () => {
    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.setDuration(Infinity)
    })

    const setDurationCalls = mockRuntime.sendMessage.mock.calls.filter(
      (call: [TimerMessage, unknown]) => call[0].type === 'SET_DURATION'
    )
    expect(setDurationCalls).toHaveLength(0)
    unmount()
  })

  it('sends message for valid positive duration', async () => {
    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.setDuration(10 * 60)
    })

    expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
      { type: 'SET_DURATION', payload: { duration: 10 * 60 } },
      expect.any(Function)
    )
    unmount()
  })

  it('floors decimal durations before sending', async () => {
    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.setDuration(90.7)
    })

    expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
      { type: 'SET_DURATION', payload: { duration: 90 } },
      expect.any(Function)
    )
    unmount()
  })
})

describe('PresetsSection Component – Custom Time edge cases', () => {
  const mockOnSetDuration = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects zero via button click (button is disabled)', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '0' } })
    expect(screen.getByTestId('custom-duration-submit')).toBeDisabled()
    unmount()
  })

  it('rejects zero via Enter key', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnSetDuration).not.toHaveBeenCalled()
    unmount()
  })

  it('rejects negative number via Enter key', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '-10' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnSetDuration).not.toHaveBeenCalled()
    unmount()
  })

  it('rejects negative number via button click (button is disabled)', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '-5' } })
    expect(screen.getByTestId('custom-duration-submit')).toBeDisabled()
    unmount()
  })

  it('rejects very small decimal that floors to zero (0.5)', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '0.5' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnSetDuration).not.toHaveBeenCalled()
    unmount()
  })

  it('rejects very small decimal that floors to zero (0.1)', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '0.1' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnSetDuration).not.toHaveBeenCalled()
    unmount()
  })

  it('rejects very small decimal that floors to zero (0.99)', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '0.99' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnSetDuration).not.toHaveBeenCalled()
    unmount()
  })

  it('accepts 1 minute as minimum valid input', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('custom-duration-submit'))
    expect(mockOnSetDuration).toHaveBeenCalledWith(60)
    unmount()
  })

  it('accepts decimal >= 1 and floors it (1.9 -> 1 minute)', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '1.9' } })
    fireEvent.click(screen.getByTestId('custom-duration-submit'))
    expect(mockOnSetDuration).toHaveBeenCalledWith(60)
    unmount()
  })

  it('does not clear input when submission is rejected (zero)', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue(0)
    unmount()
  })

  it('does not clear input when submission is rejected (negative)', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '-3' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue(-3)
    unmount()
  })

  it('clears input after valid submission', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('custom-duration-submit'))
    expect(input).toHaveValue(null) // empty string -> null for number input
    unmount()
  })

  it('accepts large valid number (999 minutes)', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '999' } })
    fireEvent.click(screen.getByTestId('custom-duration-submit'))
    expect(mockOnSetDuration).toHaveBeenCalledWith(999 * 60)
    unmount()
  })

  it('rejects empty input via Enter key', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnSetDuration).not.toHaveBeenCalled()
    unmount()
  })

  it('disables submit button for empty input', () => {
    const { unmount } = render(
      <PresetsSection currentDuration={25 * 60} isRunning={false} onSetDuration={mockOnSetDuration} />
    )
    expect(screen.getByTestId('custom-duration-submit')).toBeDisabled()
    unmount()
  })
})

describe('TimerView – Custom Time edge case integration', () => {
  beforeEach(() => {
    resetUiMock()
    vi.clearAllMocks()
    resetUiMock()
  })

  it('does not send SET_DURATION for zero custom input', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('custom-duration-input')).toBeInTheDocument()
    })

    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // Wait a tick and verify no SET_DURATION was sent
    await waitFor(() => {
      const setDurationCalls = mockRuntime.sendMessage.mock.calls.filter(
        (call: [TimerMessage, unknown]) => call[0].type === 'SET_DURATION'
      )
      expect(setDurationCalls).toHaveLength(0)
    })
    unmount()
  })

  it('does not send SET_DURATION for negative custom input', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('custom-duration-input')).toBeInTheDocument()
    })

    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '-5' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      const setDurationCalls = mockRuntime.sendMessage.mock.calls.filter(
        (call: [TimerMessage, unknown]) => call[0].type === 'SET_DURATION'
      )
      expect(setDurationCalls).toHaveLength(0)
    })
    unmount()
  })

  it('sends SET_DURATION for valid custom input', async () => {
    const newState: TimerStorageState = {
      ...UI_DEFAULT,
      duration: 10 * 60,
      timeLeft: 10 * 60,
    }
    mockRuntime.sendMessage.mockImplementation(
      (message: TimerMessage, callback: (response: TimerMessageResponse) => void) => {
        if (message.type === 'SET_DURATION') {
          uiState = newState
          callback({ state: newState })
        } else {
          callback({ state: uiState })
        }
      }
    )

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('custom-duration-input')).toBeInTheDocument()
    })

    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('custom-duration-submit'))

    await waitFor(() => {
      const setDurationCalls = mockRuntime.sendMessage.mock.calls.filter(
        (call: [TimerMessage, unknown]) => call[0].type === 'SET_DURATION'
      )
      expect(setDurationCalls).toHaveLength(1)
    })
    unmount()
  })

  it('does not update timer display for zero custom input', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-display')).toHaveTextContent('25:00')
    })

    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // Timer should still show 25:00 (unchanged)
    expect(screen.getByTestId('timer-display')).toHaveTextContent('25:00')
    unmount()
  })

  it('does not update timer display for negative custom input', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-display')).toHaveTextContent('25:00')
    })

    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '-10' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByTestId('timer-display')).toHaveTextContent('25:00')
    unmount()
  })
})
