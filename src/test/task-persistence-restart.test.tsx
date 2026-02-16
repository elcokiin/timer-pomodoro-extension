/**
 * Phase 6 – Final Validation
 *
 * Ensure tasks remain saved after a browser restart.
 *
 * The Chrome Extension architecture persists tasks via:
 * 1. `useChromeStorage('tasks', [])` reads from `chrome.storage.local` on mount
 * 2. Every mutation (add, toggle, delete, select) immediately calls
 *    `chrome.storage.local.set()` to persist the updated task array
 * 3. `chrome.storage.local` is persistent storage that survives browser restarts,
 *    extension reloads, and popup close/reopen cycles
 *
 * These tests simulate browser restart by:
 * - Writing tasks to chrome.storage.local
 * - Unmounting all React components (simulating browser close)
 * - Remounting components fresh (simulating browser restart and popup reopen)
 * - Verifying that all task data is correctly restored
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import type { Task } from '../types/index'

// ── Chrome API Mocks ────────────────────────────────────────────────

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
  storage: mockStorage,
})

// ── Import modules under test (after chrome mock is set up) ─────────

const { useTasks } = await import('../hooks/useTasks')
const { useChromeStorage } = await import('../hooks/useChromeStorage')
const { TaskList } = await import('../components/TaskList')

// ── Helpers ─────────────────────────────────────────────────────────

function clearStorage() {
  for (const key of Object.keys(storageData)) {
    delete storageData[key]
  }
}

function clearListeners() {
  storageListeners.length = 0
}

function makeTask(overrides: Partial<Task> & { id: string; text: string }): Task {
  return {
    completed: false,
    isSelected: false,
    ...overrides,
  }
}

/**
 * Simulate a browser restart: write tasks directly to storage
 * (as if persisted from a previous session), then mount a fresh hook.
 */
function seedTasks(tasks: Task[]) {
  storageData['tasks'] = tasks
}

// ── Tests ───────────────────────────────────────────────────────────

// ═════════════════════════════════════════════════════════════════════
//  useChromeStorage – Task Persistence Round-Trip
// ═════════════════════════════════════════════════════════════════════

describe('useChromeStorage – Task Persistence Round-Trip', () => {
  beforeEach(() => {
    clearStorage()
    clearListeners()
    vi.clearAllMocks()
  })

  it('restores tasks from storage on mount', async () => {
    const tasks: Task[] = [
      makeTask({ id: '1', text: 'Buy groceries' }),
      makeTask({ id: '2', text: 'Read a book', completed: true }),
    ]
    seedTasks(tasks)

    const { result, unmount } = renderHook(() =>
      useChromeStorage<Task[]>('tasks', [])
    )

    await waitFor(() => expect(result.current[2]).toBe(false)) // isLoading done
    expect(result.current[0]).toEqual(tasks)
    unmount()
  })

  it('survives unmount + remount (simulated restart)', async () => {
    // Session 1: write tasks
    const { result: r1, unmount: unmount1 } = renderHook(() =>
      useChromeStorage<Task[]>('tasks', [])
    )
    await waitFor(() => expect(r1.current[2]).toBe(false))

    act(() => {
      r1.current[1]([
        makeTask({ id: 'a', text: 'Task A' }),
        makeTask({ id: 'b', text: 'Task B' }),
      ])
    })

    // Verify persisted to storage
    expect(storageData['tasks']).toEqual([
      makeTask({ id: 'a', text: 'Task A' }),
      makeTask({ id: 'b', text: 'Task B' }),
    ])

    // Simulate browser close
    unmount1()

    // Session 2: fresh mount (simulated restart)
    const { result: r2, unmount: unmount2 } = renderHook(() =>
      useChromeStorage<Task[]>('tasks', [])
    )

    await waitFor(() => expect(r2.current[2]).toBe(false))
    expect(r2.current[0]).toEqual([
      makeTask({ id: 'a', text: 'Task A' }),
      makeTask({ id: 'b', text: 'Task B' }),
    ])
    unmount2()
  })

  it('preserves task completed state across restart', async () => {
    seedTasks([
      makeTask({ id: '1', text: 'Done task', completed: true }),
      makeTask({ id: '2', text: 'Pending task', completed: false }),
    ])

    const { result, unmount } = renderHook(() =>
      useChromeStorage<Task[]>('tasks', [])
    )
    await waitFor(() => expect(result.current[2]).toBe(false))

    expect(result.current[0][0].completed).toBe(true)
    expect(result.current[0][1].completed).toBe(false)
    unmount()
  })

  it('preserves task isSelected state across restart', async () => {
    seedTasks([
      makeTask({ id: '1', text: 'Selected task', isSelected: true }),
      makeTask({ id: '2', text: 'Not selected', isSelected: false }),
    ])

    const { result, unmount } = renderHook(() =>
      useChromeStorage<Task[]>('tasks', [])
    )
    await waitFor(() => expect(result.current[2]).toBe(false))

    expect(result.current[0][0].isSelected).toBe(true)
    expect(result.current[0][1].isSelected).toBe(false)
    unmount()
  })

  it('returns default (empty array) when storage is empty on first launch', async () => {
    // No seedTasks – simulate fresh install
    const { result, unmount } = renderHook(() =>
      useChromeStorage<Task[]>('tasks', [])
    )
    await waitFor(() => expect(result.current[2]).toBe(false))
    expect(result.current[0]).toEqual([])
    unmount()
  })
})

// ═════════════════════════════════════════════════════════════════════
//  useTasks Hook – Persistence After Restart
// ═════════════════════════════════════════════════════════════════════

describe('useTasks Hook – Persistence After Restart', () => {
  beforeEach(() => {
    clearStorage()
    clearListeners()
    vi.clearAllMocks()
  })

  it('restores previously added tasks after unmount + remount', async () => {
    // Session 1: add tasks
    const { result: r1, unmount: unmount1 } = renderHook(() => useTasks())
    await waitFor(() => expect(r1.current.isLoading).toBe(false))

    act(() => r1.current.addTask('Write tests'))
    act(() => r1.current.addTask('Fix bugs'))

    expect(r1.current.tasks).toHaveLength(2)
    expect(r1.current.tasks[0].text).toBe('Write tests')
    expect(r1.current.tasks[1].text).toBe('Fix bugs')

    // Simulate browser close
    unmount1()

    // Session 2: remount
    const { result: r2, unmount: unmount2 } = renderHook(() => useTasks())
    await waitFor(() => expect(r2.current.isLoading).toBe(false))

    expect(r2.current.tasks).toHaveLength(2)
    expect(r2.current.tasks[0].text).toBe('Write tests')
    expect(r2.current.tasks[1].text).toBe('Fix bugs')
    unmount2()
  })

  it('preserves toggled completion state after restart', async () => {
    // Session 1: add and toggle
    const { result: r1, unmount: unmount1 } = renderHook(() => useTasks())
    await waitFor(() => expect(r1.current.isLoading).toBe(false))

    act(() => r1.current.addTask('Complete me'))
    const taskId = r1.current.tasks[0].id

    act(() => r1.current.toggleTask(taskId))
    expect(r1.current.tasks[0].completed).toBe(true)

    unmount1()

    // Session 2: verify completion persisted
    const { result: r2, unmount: unmount2 } = renderHook(() => useTasks())
    await waitFor(() => expect(r2.current.isLoading).toBe(false))

    expect(r2.current.tasks[0].completed).toBe(true)
    unmount2()
  })

  it('preserves selected task after restart', async () => {
    // Session 1: add and select
    const { result: r1, unmount: unmount1 } = renderHook(() => useTasks())
    await waitFor(() => expect(r1.current.isLoading).toBe(false))

    act(() => r1.current.addTask('Focus on this'))
    const taskId = r1.current.tasks[0].id

    act(() => r1.current.selectTask(taskId))
    expect(r1.current.tasks[0].isSelected).toBe(true)

    unmount1()

    // Session 2: verify selection persisted
    const { result: r2, unmount: unmount2 } = renderHook(() => useTasks())
    await waitFor(() => expect(r2.current.isLoading).toBe(false))

    expect(r2.current.tasks[0].isSelected).toBe(true)
    unmount2()
  })

  it('persists deletion across restart', async () => {
    // Session 1: seed three tasks with distinct IDs, delete the middle one
    seedTasks([
      makeTask({ id: 'del-a', text: 'Task A' }),
      makeTask({ id: 'del-b', text: 'Task B' }),
      makeTask({ id: 'del-c', text: 'Task C' }),
    ])

    const { result: r1, unmount: unmount1 } = renderHook(() => useTasks())
    await waitFor(() => expect(r1.current.isLoading).toBe(false))

    expect(r1.current.tasks).toHaveLength(3)

    act(() => r1.current.deleteTask('del-b'))

    expect(r1.current.tasks).toHaveLength(2)
    expect(r1.current.tasks.map((t) => t.text)).toEqual(['Task A', 'Task C'])

    unmount1()

    // Session 2: verify only 2 tasks remain
    const { result: r2, unmount: unmount2 } = renderHook(() => useTasks())
    await waitFor(() => expect(r2.current.isLoading).toBe(false))

    expect(r2.current.tasks).toHaveLength(2)
    expect(r2.current.tasks.map((t) => t.text)).toEqual(['Task A', 'Task C'])
    unmount2()
  })

  it('preserves task IDs across restart', async () => {
    // Session 1: add tasks
    const { result: r1, unmount: unmount1 } = renderHook(() => useTasks())
    await waitFor(() => expect(r1.current.isLoading).toBe(false))

    act(() => r1.current.addTask('Persistent task'))
    const originalId = r1.current.tasks[0].id

    unmount1()

    // Session 2: verify same ID
    const { result: r2, unmount: unmount2 } = renderHook(() => useTasks())
    await waitFor(() => expect(r2.current.isLoading).toBe(false))

    expect(r2.current.tasks[0].id).toBe(originalId)
    unmount2()
  })

  it('can modify restored tasks after restart', async () => {
    // Session 1: add a task
    const { result: r1, unmount: unmount1 } = renderHook(() => useTasks())
    await waitFor(() => expect(r1.current.isLoading).toBe(false))

    act(() => r1.current.addTask('Old task'))
    unmount1()

    // Session 2: add a new task to the restored list
    const { result: r2, unmount: unmount2 } = renderHook(() => useTasks())
    await waitFor(() => expect(r2.current.isLoading).toBe(false))

    act(() => r2.current.addTask('New task'))
    expect(r2.current.tasks).toHaveLength(2)
    expect(r2.current.tasks[0].text).toBe('Old task')
    expect(r2.current.tasks[1].text).toBe('New task')

    unmount2()

    // Session 3: verify both are still there
    const { result: r3, unmount: unmount3 } = renderHook(() => useTasks())
    await waitFor(() => expect(r3.current.isLoading).toBe(false))

    expect(r3.current.tasks).toHaveLength(2)
    expect(r3.current.tasks[0].text).toBe('Old task')
    expect(r3.current.tasks[1].text).toBe('New task')
    unmount3()
  })

  it('preserves multiple task states simultaneously across restart', async () => {
    // Session 1: seed varied tasks with distinct IDs, then modify states
    seedTasks([
      makeTask({ id: 'multi-1', text: 'Completed task' }),
      makeTask({ id: 'multi-2', text: 'Selected task' }),
      makeTask({ id: 'multi-3', text: 'Plain task' }),
    ])

    const { result: r1, unmount: unmount1 } = renderHook(() => useTasks())
    await waitFor(() => expect(r1.current.isLoading).toBe(false))

    act(() => r1.current.toggleTask('multi-1'))
    act(() => r1.current.selectTask('multi-2'))

    unmount1()

    // Session 2: verify all states
    const { result: r2, unmount: unmount2 } = renderHook(() => useTasks())
    await waitFor(() => expect(r2.current.isLoading).toBe(false))

    expect(r2.current.tasks).toHaveLength(3)

    // Task 0: completed=true, isSelected=false
    expect(r2.current.tasks[0].text).toBe('Completed task')
    expect(r2.current.tasks[0].completed).toBe(true)
    expect(r2.current.tasks[0].isSelected).toBe(false)

    // Task 1: completed=false, isSelected=true
    expect(r2.current.tasks[1].text).toBe('Selected task')
    expect(r2.current.tasks[1].completed).toBe(false)
    expect(r2.current.tasks[1].isSelected).toBe(true)

    // Task 2: completed=false, isSelected=false
    expect(r2.current.tasks[2].text).toBe('Plain task')
    expect(r2.current.tasks[2].completed).toBe(false)
    expect(r2.current.tasks[2].isSelected).toBe(false)

    unmount2()
  })
})

// ═════════════════════════════════════════════════════════════════════
//  TaskList Component – Persistence After Restart
// ═════════════════════════════════════════════════════════════════════

describe('TaskList Component – Persistence After Restart', () => {
  beforeEach(() => {
    clearStorage()
    clearListeners()
    vi.clearAllMocks()
  })

  it('renders tasks from storage on mount (simulated restart)', async () => {
    seedTasks([
      makeTask({ id: '1', text: 'Saved task 1' }),
      makeTask({ id: '2', text: 'Saved task 2' }),
      makeTask({ id: '3', text: 'Saved task 3' }),
    ])

    const { unmount } = render(<TaskList />)

    await waitFor(() => {
      expect(screen.queryByTestId('tasks-loading')).not.toBeInTheDocument()
    })

    expect(screen.getByText('Saved task 1')).toBeInTheDocument()
    expect(screen.getByText('Saved task 2')).toBeInTheDocument()
    expect(screen.getByText('Saved task 3')).toBeInTheDocument()
    unmount()
  })

  it('shows completed styling for persisted completed tasks', async () => {
    seedTasks([
      makeTask({ id: '1', text: 'Done task', completed: true }),
      makeTask({ id: '2', text: 'Pending task', completed: false }),
    ])

    const { unmount } = render(<TaskList />)

    await waitFor(() => {
      expect(screen.queryByTestId('tasks-loading')).not.toBeInTheDocument()
    })

    const doneText = screen.getByText('Done task')
    const pendingText = screen.getByText('Pending task')

    expect(doneText.className).toContain('line-through')
    expect(pendingText.className).not.toContain('line-through')
    unmount()
  })

  it('shows selected styling for persisted selected tasks', async () => {
    seedTasks([
      makeTask({ id: '1', text: 'Active task', isSelected: true }),
      makeTask({ id: '2', text: 'Inactive task', isSelected: false }),
    ])

    const { unmount } = render(<TaskList />)

    await waitFor(() => {
      expect(screen.queryByTestId('tasks-loading')).not.toBeInTheDocument()
    })

    const activeRow = screen.getByTestId('task-item-1')
    const inactiveRow = screen.getByTestId('task-item-2')

    expect(activeRow.className).toContain('bg-muted/70')
    expect(inactiveRow.className).not.toContain('bg-muted/70')
    unmount()
  })

  it('does not show empty state when tasks exist in storage', async () => {
    seedTasks([makeTask({ id: '1', text: 'Persisted task' })])

    const { unmount } = render(<TaskList />)

    await waitFor(() => {
      expect(screen.queryByTestId('tasks-loading')).not.toBeInTheDocument()
    })

    expect(screen.queryByTestId('tasks-empty')).not.toBeInTheDocument()
    expect(screen.getByText('Persisted task')).toBeInTheDocument()
    unmount()
  })

  it('shows empty state when storage has no tasks (fresh install)', async () => {
    // No seedTasks - simulate fresh install
    const { unmount } = render(<TaskList />)

    await waitFor(() => {
      expect(screen.queryByTestId('tasks-loading')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('tasks-empty')).toBeInTheDocument()
    unmount()
  })

  it('adds tasks that persist, then remounts and sees them', async () => {
    // Session 1: add a task via the UI
    const { unmount: unmount1 } = render(<TaskList />)

    await waitFor(() => {
      expect(screen.queryByTestId('tasks-loading')).not.toBeInTheDocument()
    })

    const input = screen.getByTestId('add-task-input')
    const addButton = screen.getByTestId('add-task-button')

    fireEvent.change(input, { target: { value: 'UI added task' } })
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('UI added task')).toBeInTheDocument()
    })

    // Simulate browser close
    unmount1()

    // Session 2: remount and verify task persists
    const { unmount: unmount2 } = render(<TaskList />)

    await waitFor(() => {
      expect(screen.queryByTestId('tasks-loading')).not.toBeInTheDocument()
    })

    expect(screen.getByText('UI added task')).toBeInTheDocument()
    unmount2()
  })

  it('preserves checkbox state after component remount', async () => {
    seedTasks([
      makeTask({ id: '1', text: 'Check me', completed: false }),
    ])

    // Session 1: toggle the checkbox
    const { unmount: unmount1 } = render(<TaskList />)

    await waitFor(() => {
      expect(screen.queryByTestId('tasks-loading')).not.toBeInTheDocument()
    })

    const checkbox = screen.getByTestId('task-checkbox-1')
    fireEvent.click(checkbox)

    await waitFor(() => {
      const text = screen.getByText('Check me')
      expect(text.className).toContain('line-through')
    })

    unmount1()

    // Session 2: verify checked state persists
    const { unmount: unmount2 } = render(<TaskList />)

    await waitFor(() => {
      expect(screen.queryByTestId('tasks-loading')).not.toBeInTheDocument()
    })

    const restoredText = screen.getByText('Check me')
    expect(restoredText.className).toContain('line-through')
    unmount2()
  })

  it('persists task count correctly across multiple restarts', async () => {
    // Session 1: seed with 5 tasks
    seedTasks([
      makeTask({ id: '1', text: 'Task 1' }),
      makeTask({ id: '2', text: 'Task 2' }),
      makeTask({ id: '3', text: 'Task 3' }),
      makeTask({ id: '4', text: 'Task 4' }),
      makeTask({ id: '5', text: 'Task 5' }),
    ])

    const { unmount: unmount1 } = render(<TaskList />)

    await waitFor(() => {
      expect(screen.queryByTestId('tasks-loading')).not.toBeInTheDocument()
    })

    // All 5 items rendered
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`task-item-${i}`)).toBeInTheDocument()
    }

    unmount1()

    // Session 2: verify same 5 tasks
    const { unmount: unmount2 } = render(<TaskList />)

    await waitFor(() => {
      expect(screen.queryByTestId('tasks-loading')).not.toBeInTheDocument()
    })

    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`task-item-${i}`)).toBeInTheDocument()
    }

    unmount2()
  })
})

// ═════════════════════════════════════════════════════════════════════
//  Storage Persistence Guarantees
// ═════════════════════════════════════════════════════════════════════

describe('Storage Persistence Guarantees', () => {
  beforeEach(() => {
    clearStorage()
    clearListeners()
    vi.clearAllMocks()
  })

  it('chrome.storage.local.set is called when tasks are added', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.addTask('Persisted task'))

    expect(mockStorage.local.set).toHaveBeenCalledWith({
      tasks: expect.arrayContaining([
        expect.objectContaining({ text: 'Persisted task' }),
      ]),
    })
    unmount()
  })

  it('chrome.storage.local.set is called when tasks are toggled', async () => {
    seedTasks([makeTask({ id: '1', text: 'Toggle me' })])

    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    vi.clearAllMocks()
    act(() => result.current.toggleTask('1'))

    expect(mockStorage.local.set).toHaveBeenCalledWith({
      tasks: [expect.objectContaining({ id: '1', completed: true })],
    })
    unmount()
  })

  it('chrome.storage.local.set is called when tasks are deleted', async () => {
    seedTasks([
      makeTask({ id: '1', text: 'Keep' }),
      makeTask({ id: '2', text: 'Delete me' }),
    ])

    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    vi.clearAllMocks()
    act(() => result.current.deleteTask('2'))

    expect(mockStorage.local.set).toHaveBeenCalledWith({
      tasks: [expect.objectContaining({ id: '1', text: 'Keep' })],
    })
    unmount()
  })

  it('chrome.storage.local.set is called when tasks are selected', async () => {
    seedTasks([makeTask({ id: '1', text: 'Select me' })])

    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    vi.clearAllMocks()
    act(() => result.current.selectTask('1'))

    expect(mockStorage.local.set).toHaveBeenCalledWith({
      tasks: [expect.objectContaining({ id: '1', isSelected: true })],
    })
    unmount()
  })

  it('chrome.storage.local.get is called with "tasks" key on mount', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(mockStorage.local.get).toHaveBeenCalledWith('tasks')
    unmount()
  })

  it('storage data structure preserves all Task fields', async () => {
    const fullTask: Task = {
      id: 'test-id-123',
      text: 'Full task with all fields',
      completed: true,
      isSelected: true,
    }
    seedTasks([fullTask])

    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const restored = result.current.tasks[0]
    expect(restored.id).toBe('test-id-123')
    expect(restored.text).toBe('Full task with all fields')
    expect(restored.completed).toBe(true)
    expect(restored.isSelected).toBe(true)
    unmount()
  })

  it('multiple rapid mutations all persist to storage', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.addTask('Task 1'))
    act(() => result.current.addTask('Task 2'))
    act(() => result.current.addTask('Task 3'))

    // Final storage state should have all 3 tasks
    const stored = storageData['tasks'] as Task[]
    expect(stored).toHaveLength(3)
    expect(stored.map((t) => t.text)).toEqual(['Task 1', 'Task 2', 'Task 3'])
    unmount()
  })

  it('external storage change (from background script) updates task list', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Simulate external change (e.g. another extension page or background script)
    const newTasks: Task[] = [
      makeTask({ id: 'ext-1', text: 'Externally added' }),
    ]

    act(() => {
      for (const listener of [...storageListeners]) {
        listener(
          { tasks: { newValue: newTasks } },
          'local'
        )
      }
    })

    expect(result.current.tasks).toEqual(newTasks)
    unmount()
  })
})
