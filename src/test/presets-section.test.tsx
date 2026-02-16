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
  storage: {
    local: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
})

// ── Import modules under test (after chrome mock is set up) ─────────

const { useTimer } = await import('../hooks/useTimer')
const { PresetsSection } = await import('../components/PresetsSection')
const { TimerView } = await import('../components/TimerView')

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

function respondWith(type: string, state: TimerStorageState) {
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

describe('useTimer Hook – setDuration', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
    resetState()
  })

  it('exposes setDuration function', async () => {
    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(typeof result.current.setDuration).toBe('function')
    unmount()
  })

  it('sends SET_DURATION message with duration payload', async () => {
    const newState: TimerStorageState = {
      ...DEFAULT_STATE,
      duration: 50 * 60,
      timeLeft: 50 * 60,
    }
    respondWith('SET_DURATION', newState)

    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.setDuration(50 * 60)
    })

    expect(mockSendMessage).toHaveBeenCalledWith(
      { type: 'SET_DURATION', payload: { duration: 50 * 60 } },
      expect.any(Function)
    )
    unmount()
  })

  it('updates state after setDuration()', async () => {
    const newState: TimerStorageState = {
      ...DEFAULT_STATE,
      duration: 15 * 60,
      timeLeft: 15 * 60,
    }
    respondWith('SET_DURATION', newState)

    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.setDuration(15 * 60)
    })

    expect(result.current.state.duration).toBe(15 * 60)
    expect(result.current.state.timeLeft).toBe(15 * 60)
    unmount()
  })

  it('stops polling after setDuration()', async () => {
    resetState({ isRunning: true, startTime: Date.now() })

    const stoppedState: TimerStorageState = {
      ...DEFAULT_STATE,
      duration: 15 * 60,
      timeLeft: 15 * 60,
      isRunning: false,
      startTime: null,
    }
    respondWith('SET_DURATION', stoppedState)

    const { result, unmount } = renderHook(() => useTimer())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.setDuration(15 * 60)
    })

    expect(result.current.state.isRunning).toBe(false)
    unmount()
  })
})

describe('PresetsSection Component', () => {
  const mockOnSetDuration = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Rendering ─────────────────────────────────────────────────────

  it('renders the presets section container', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    expect(screen.getByTestId('presets-section')).toBeInTheDocument()
    unmount()
  })

  it('renders the preset buttons container', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    expect(screen.getByTestId('presets-buttons')).toBeInTheDocument()
    unmount()
  })

  it('renders three preset buttons (25m, 50m, 15m)', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    expect(screen.getByTestId('preset-25')).toBeInTheDocument()
    expect(screen.getByTestId('preset-50')).toBeInTheDocument()
    expect(screen.getByTestId('preset-15')).toBeInTheDocument()
    unmount()
  })

  it('renders preset button labels', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    expect(screen.getByTestId('preset-25')).toHaveTextContent('25m')
    expect(screen.getByTestId('preset-50')).toHaveTextContent('50m')
    expect(screen.getByTestId('preset-15')).toHaveTextContent('15m')
    unmount()
  })

  it('renders the custom duration section', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    expect(screen.getByTestId('custom-duration')).toBeInTheDocument()
    unmount()
  })

  it('renders the custom duration input', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    expect(screen.getByTestId('custom-duration-input')).toBeInTheDocument()
    unmount()
  })

  it('renders the custom duration submit button', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    expect(screen.getByTestId('custom-duration-submit')).toBeInTheDocument()
    unmount()
  })

  it('submit button has "Set" text', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    expect(screen.getByTestId('custom-duration-submit')).toHaveTextContent('Set')
    unmount()
  })

  it('custom input has placeholder text', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    expect(screen.getByTestId('custom-duration-input')).toHaveAttribute('placeholder', 'Custom (min)')
    unmount()
  })

  it('custom input has type number', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    expect(screen.getByTestId('custom-duration-input')).toHaveAttribute('type', 'number')
    unmount()
  })

  // ── Preset button clicks ──────────────────────────────────────────

  it('calls onSetDuration with 25*60 when 25m preset is clicked', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={50 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    fireEvent.click(screen.getByTestId('preset-25'))
    expect(mockOnSetDuration).toHaveBeenCalledWith(25 * 60)
    unmount()
  })

  it('calls onSetDuration with 50*60 when 50m preset is clicked', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    fireEvent.click(screen.getByTestId('preset-50'))
    expect(mockOnSetDuration).toHaveBeenCalledWith(50 * 60)
    unmount()
  })

  it('calls onSetDuration with 15*60 when 15m preset is clicked', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    fireEvent.click(screen.getByTestId('preset-15'))
    expect(mockOnSetDuration).toHaveBeenCalledWith(15 * 60)
    unmount()
  })

  // ── Custom duration input ─────────────────────────────────────────

  it('calls onSetDuration with custom minutes * 60 when Set is clicked', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('custom-duration-submit'))
    expect(mockOnSetDuration).toHaveBeenCalledWith(10 * 60)
    unmount()
  })

  it('calls onSetDuration when Enter is pressed in custom input', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '45' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnSetDuration).toHaveBeenCalledWith(45 * 60)
    unmount()
  })

  it('clears custom input after successful submission', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('custom-duration-submit'))
    expect(input).toHaveValue(null) // number input with empty string shows as null
    unmount()
  })

  it('floors decimal custom minutes', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '7.5' } })
    fireEvent.click(screen.getByTestId('custom-duration-submit'))
    expect(mockOnSetDuration).toHaveBeenCalledWith(7 * 60)
    unmount()
  })

  // ── Validation: does NOT call onSetDuration for invalid input ─────

  it('does not call onSetDuration for empty custom input', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    fireEvent.click(screen.getByTestId('custom-duration-submit'))
    expect(mockOnSetDuration).not.toHaveBeenCalled()
    unmount()
  })

  it('does not call onSetDuration for zero custom input', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '0' } })
    // Try Enter key submission (bypasses button disabled state)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnSetDuration).not.toHaveBeenCalled()
    unmount()
  })

  it('does not call onSetDuration for negative custom input', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '-5' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnSetDuration).not.toHaveBeenCalled()
    unmount()
  })

  // ── Disabled state when running ───────────────────────────────────

  it('disables preset buttons when timer is running', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={true}
        onSetDuration={mockOnSetDuration}
      />
    )
    expect(screen.getByTestId('preset-25')).toBeDisabled()
    expect(screen.getByTestId('preset-50')).toBeDisabled()
    expect(screen.getByTestId('preset-15')).toBeDisabled()
    unmount()
  })

  it('disables custom input when timer is running', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={true}
        onSetDuration={mockOnSetDuration}
      />
    )
    expect(screen.getByTestId('custom-duration-input')).toBeDisabled()
    unmount()
  })

  it('disables custom submit button when timer is running', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={true}
        onSetDuration={mockOnSetDuration}
      />
    )
    expect(screen.getByTestId('custom-duration-submit')).toBeDisabled()
    unmount()
  })

  // ── Active preset highlighting ────────────────────────────────────

  it('does not highlight 50m preset when current duration is 25m', () => {
    const { unmount } = render(
      <PresetsSection
        currentDuration={25 * 60}
        isRunning={false}
        onSetDuration={mockOnSetDuration}
      />
    )
    // The 50m preset should have variant="outline" (not default),
    // so it should NOT have data-slot="button" with the default variant styling.
    // We check by verifying the 25m has different class than 50m.
    const preset25 = screen.getByTestId('preset-25')
    const preset50 = screen.getByTestId('preset-50')
    // The "default" variant button won't have "border" in outer class; outline will
    // We just verify they have different classes
    expect(preset25.className).not.toBe(preset50.className)
    unmount()
  })
})

describe('TimerView – PresetsSection integration', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
    resetState()
  })

  it('renders the presets section inside TimerView', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('presets-section')).toBeInTheDocument()
    })
    unmount()
  })

  it('renders preset buttons inside TimerView', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('preset-25')).toBeInTheDocument()
      expect(screen.getByTestId('preset-50')).toBeInTheDocument()
      expect(screen.getByTestId('preset-15')).toBeInTheDocument()
    })
    unmount()
  })

  it('renders custom duration input inside TimerView', async () => {
    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('custom-duration-input')).toBeInTheDocument()
    })
    unmount()
  })

  it('sends SET_DURATION when a preset is clicked in TimerView', async () => {
    const newState: TimerStorageState = {
      ...DEFAULT_STATE,
      duration: 50 * 60,
      timeLeft: 50 * 60,
    }
    respondWith('SET_DURATION', newState)

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('preset-50')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('preset-50'))

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        { type: 'SET_DURATION', payload: { duration: 50 * 60 } },
        expect.any(Function)
      )
    })
    unmount()
  })

  it('updates countdown display when preset is clicked', async () => {
    const newState: TimerStorageState = {
      ...DEFAULT_STATE,
      duration: 15 * 60,
      timeLeft: 15 * 60,
    }
    respondWith('SET_DURATION', newState)

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-display')).toHaveTextContent('25:00')
    })

    fireEvent.click(screen.getByTestId('preset-15'))

    await waitFor(() => {
      expect(screen.getByTestId('timer-display')).toHaveTextContent('15:00')
    })
    unmount()
  })

  it('sends SET_DURATION for custom input in TimerView', async () => {
    const newState: TimerStorageState = {
      ...DEFAULT_STATE,
      duration: 10 * 60,
      timeLeft: 10 * 60,
    }
    respondWith('SET_DURATION', newState)

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('custom-duration-input')).toBeInTheDocument()
    })

    const input = screen.getByTestId('custom-duration-input')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('custom-duration-submit'))

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        { type: 'SET_DURATION', payload: { duration: 10 * 60 } },
        expect.any(Function)
      )
    })
    unmount()
  })

  it('disables presets when timer is running in TimerView', async () => {
    resetState({ isRunning: true, startTime: Date.now() })

    const { unmount } = render(<TimerView />)
    await waitFor(() => {
      expect(screen.getByTestId('preset-25')).toBeDisabled()
      expect(screen.getByTestId('preset-50')).toBeDisabled()
      expect(screen.getByTestId('preset-15')).toBeDisabled()
    })
    unmount()
  })
})
