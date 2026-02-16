import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ── Chrome API Mock ─────────────────────────────────────────────────

const DEFAULT_STATE = {
  duration: 25 * 60,
  timeLeft: 25 * 60,
  isRunning: false,
  startTime: null,
  mode: 'work',
}

vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: vi.fn((_message: unknown, callback: (response: unknown) => void) => {
      callback({ state: DEFAULT_STATE })
    }),
  },
})

// ── Import module under test (after chrome mock is set up) ──────────

const { default: App } = await import('../App')

// ── Tests ───────────────────────────────────────────────────────────

describe('App', () => {
  it('renders the application title', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Pomodoro Timer')).toBeInTheDocument()
    })
  })

  it('renders the tagline', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Focus. Work. Rest. Repeat.')).toBeInTheDocument()
    })
  })

  it('renders within the app container', async () => {
    const { container } = render(<App />)
    const appDiv = container.querySelector('.app')
    expect(appDiv).toBeInTheDocument()
  })
})
