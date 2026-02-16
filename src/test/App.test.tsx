import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Chrome API Mock ─────────────────────────────────────────────────

const DEFAULT_STATE = {
  duration: 25 * 60,
  timeLeft: 25 * 60,
  isRunning: false,
  startTime: null,
  mode: 'work',
}

const storageData: Record<string, unknown> = {}

type StorageChangeListener = (
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string
) => void

const storageListeners: StorageChangeListener[] = []

vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: vi.fn((_message: unknown, callback: (response: unknown) => void) => {
      callback({ state: DEFAULT_STATE })
    }),
  },
  storage: {
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
  },
})

// ── Import module under test (after chrome mock is set up) ──────────

const { default: App } = await import('../App')

// ── Helpers ─────────────────────────────────────────────────────────

function clearStorage() {
  for (const key of Object.keys(storageData)) {
    delete storageData[key]
  }
}

// ── Tests ───────────────────────────────────────────────────────────

describe('App', () => {
  beforeEach(() => {
    clearStorage()
    storageListeners.length = 0
  })

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

describe('App – Tabs Layout', () => {
  beforeEach(() => {
    clearStorage()
    storageListeners.length = 0
  })

  it('renders the tabs list', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('tabs-list')).toBeInTheDocument()
    })
  })

  it('renders "Focus" tab trigger', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('tab-focus')).toBeInTheDocument()
    })
  })

  it('renders "Tasks" tab trigger', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('tab-tasks')).toBeInTheDocument()
    })
  })

  it('Focus tab trigger has "Focus" text', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('tab-focus')).toHaveTextContent('Focus')
    })
  })

  it('Tasks tab trigger has "Tasks" text', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('tab-tasks')).toHaveTextContent('Tasks')
    })
  })

  it('Focus tab is the default active tab', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('tab-focus')).toHaveAttribute('data-state', 'active')
    })
  })

  it('Tasks tab is inactive by default', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('tab-tasks')).toHaveAttribute('data-state', 'inactive')
    })
  })

  it('shows the Focus content panel by default', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('tab-content-focus')).toBeInTheDocument()
    })
  })

  it('renders TimerView inside the Focus tab', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })
  })

  it('does not render TaskList when Focus tab is active', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })
    // Tasks content should be hidden (unmounted by radix tabs)
    expect(screen.queryByTestId('task-list')).not.toBeInTheDocument()
  })

  it('clicking Tasks tab makes it active', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('tab-focus')).toHaveAttribute('data-state', 'active')
    })

    await user.click(screen.getByTestId('tab-tasks'))

    await waitFor(() => {
      expect(screen.getByTestId('tab-tasks')).toHaveAttribute('data-state', 'active')
    })
  })

  it('clicking Tasks tab deactivates Focus tab', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('tab-focus')).toHaveAttribute('data-state', 'active')
    })

    await user.click(screen.getByTestId('tab-tasks'))

    await waitFor(() => {
      expect(screen.getByTestId('tab-focus')).toHaveAttribute('data-state', 'inactive')
    })
  })

  it('clicking Tasks tab renders the TaskList', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('tab-focus')).toHaveAttribute('data-state', 'active')
    })

    await user.click(screen.getByTestId('tab-tasks'))

    await waitFor(() => {
      expect(screen.getByTestId('task-list')).toBeInTheDocument()
    })
  })

  it('clicking Tasks tab hides the TimerView', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('tab-tasks'))

    await waitFor(() => {
      expect(screen.queryByTestId('timer-view')).not.toBeInTheDocument()
    })
  })

  it('can switch back from Tasks to Focus tab', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('tab-focus')).toHaveAttribute('data-state', 'active')
    })

    // Switch to Tasks
    await user.click(screen.getByTestId('tab-tasks'))
    await waitFor(() => {
      expect(screen.getByTestId('task-list')).toBeInTheDocument()
    })

    // Switch back to Focus
    await user.click(screen.getByTestId('tab-focus'))
    await waitFor(() => {
      expect(screen.getByTestId('tab-focus')).toHaveAttribute('data-state', 'active')
      expect(screen.getByTestId('timer-view')).toBeInTheDocument()
    })
  })

  it('renders the Tasks tab content panel when Tasks is active', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByTestId('tab-tasks'))
    await waitFor(() => {
      expect(screen.getByTestId('tab-content-tasks')).toBeInTheDocument()
    })
  })

  it('both tab triggers are rendered at all times', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('tab-focus')).toBeInTheDocument()
      expect(screen.getByTestId('tab-tasks')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('tab-tasks'))
    await waitFor(() => {
      expect(screen.getByTestId('tab-focus')).toBeInTheDocument()
      expect(screen.getByTestId('tab-tasks')).toBeInTheDocument()
    })
  })

  it('TaskList shows empty state message in Tasks tab', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByTestId('tab-tasks'))
    await waitFor(() => {
      expect(screen.getByTestId('tasks-empty')).toBeInTheDocument()
    })
  })

  it('timer countdown is visible in Focus tab by default', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('timer-display')).toBeInTheDocument()
      expect(screen.getByTestId('timer-display')).toHaveTextContent('25:00')
    })
  })
})
