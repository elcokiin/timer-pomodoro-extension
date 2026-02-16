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

function seedTasks(tasks: Task[]) {
  storageData['tasks'] = tasks
}

function makeTasks(count: number): Task[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    text: `Task ${i + 1}`,
    completed: false,
    isSelected: false,
  }))
}

// ── Tests ───────────────────────────────────────────────────────────

// ═════════════════════════════════════════════════════════════════════
//  useTasks Hook
// ═════════════════════════════════════════════════════════════════════

describe('useTasks Hook', () => {
  beforeEach(() => {
    clearStorage()
    clearListeners()
    vi.clearAllMocks()
  })

  // ── Module export ─────────────────────────────────────────────────

  it('exports useTasks function', () => {
    expect(typeof useTasks).toBe('function')
  })

  // ── Initial state ─────────────────────────────────────────────────

  it('returns empty tasks array by default', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.tasks).toEqual([])
    unmount()
  })

  it('starts with isLoading true', () => {
    const { result, unmount } = renderHook(() => useTasks())
    expect(result.current.isLoading).toBe(true)
    unmount()
  })

  it('loads tasks from storage', async () => {
    const tasks: Task[] = [
      { id: '1', text: 'Buy milk', completed: false, isSelected: false },
    ]
    seedTasks(tasks)

    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.tasks).toEqual(tasks)
    unmount()
  })

  it('returns all CRUD functions', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(typeof result.current.addTask).toBe('function')
    expect(typeof result.current.toggleTask).toBe('function')
    expect(typeof result.current.deleteTask).toBe('function')
    expect(typeof result.current.selectTask).toBe('function')
    unmount()
  })

  // ── addTask ───────────────────────────────────────────────────────

  it('addTask appends a new task', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addTask('New task')
    })

    expect(result.current.tasks).toHaveLength(1)
    expect(result.current.tasks[0].text).toBe('New task')
    unmount()
  })

  it('addTask sets completed to false', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addTask('A task')
    })

    expect(result.current.tasks[0].completed).toBe(false)
    unmount()
  })

  it('addTask sets isSelected to false', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addTask('A task')
    })

    expect(result.current.tasks[0].isSelected).toBe(false)
    unmount()
  })

  it('addTask generates a string id', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addTask('A task')
    })

    expect(typeof result.current.tasks[0].id).toBe('string')
    expect(result.current.tasks[0].id.length).toBeGreaterThan(0)
    unmount()
  })

  it('addTask trims whitespace', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addTask('  spaced  ')
    })

    expect(result.current.tasks[0].text).toBe('spaced')
    unmount()
  })

  it('addTask ignores empty strings', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addTask('')
    })

    expect(result.current.tasks).toHaveLength(0)
    unmount()
  })

  it('addTask ignores whitespace-only strings', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addTask('   ')
    })

    expect(result.current.tasks).toHaveLength(0)
    unmount()
  })

  it('addTask persists to chrome.storage.local', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addTask('Persisted task')
    })

    expect(mockStorage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: expect.arrayContaining([
          expect.objectContaining({ text: 'Persisted task' }),
        ]),
      })
    )
    unmount()
  })

  // ── toggleTask ────────────────────────────────────────────────────

  it('toggleTask marks a task as completed', async () => {
    seedTasks([
      { id: '1', text: 'Test', completed: false, isSelected: false },
    ])

    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.toggleTask('1')
    })

    expect(result.current.tasks[0].completed).toBe(true)
    unmount()
  })

  it('toggleTask unmarks a completed task', async () => {
    seedTasks([
      { id: '1', text: 'Test', completed: true, isSelected: false },
    ])

    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.toggleTask('1')
    })

    expect(result.current.tasks[0].completed).toBe(false)
    unmount()
  })

  it('toggleTask does not affect other tasks', async () => {
    seedTasks([
      { id: '1', text: 'Task 1', completed: false, isSelected: false },
      { id: '2', text: 'Task 2', completed: false, isSelected: false },
    ])

    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.toggleTask('1')
    })

    expect(result.current.tasks[0].completed).toBe(true)
    expect(result.current.tasks[1].completed).toBe(false)
    unmount()
  })

  // ── deleteTask ────────────────────────────────────────────────────

  it('deleteTask removes a task by ID', async () => {
    seedTasks([
      { id: '1', text: 'Task 1', completed: false, isSelected: false },
      { id: '2', text: 'Task 2', completed: false, isSelected: false },
    ])

    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.deleteTask('1')
    })

    expect(result.current.tasks).toHaveLength(1)
    expect(result.current.tasks[0].id).toBe('2')
    unmount()
  })

  it('deleteTask persists removal to storage', async () => {
    seedTasks([
      { id: '1', text: 'Task 1', completed: false, isSelected: false },
    ])

    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.deleteTask('1')
    })

    expect(mockStorage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ tasks: [] })
    )
    unmount()
  })

  // ── selectTask ────────────────────────────────────────────────────

  it('selectTask marks a task as selected', async () => {
    seedTasks([
      { id: '1', text: 'Task 1', completed: false, isSelected: false },
    ])

    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.selectTask('1')
    })

    expect(result.current.tasks[0].isSelected).toBe(true)
    unmount()
  })

  it('selectTask deselects a previously selected task', async () => {
    seedTasks([
      { id: '1', text: 'Task 1', completed: false, isSelected: true },
    ])

    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.selectTask('1')
    })

    expect(result.current.tasks[0].isSelected).toBe(false)
    unmount()
  })

  it('selectTask deselects other tasks when selecting one', async () => {
    seedTasks([
      { id: '1', text: 'Task 1', completed: false, isSelected: true },
      { id: '2', text: 'Task 2', completed: false, isSelected: false },
    ])

    const { result, unmount } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.selectTask('2')
    })

    expect(result.current.tasks[0].isSelected).toBe(false)
    expect(result.current.tasks[1].isSelected).toBe(true)
    unmount()
  })
})

// ═════════════════════════════════════════════════════════════════════
//  TaskList Component
// ═════════════════════════════════════════════════════════════════════

describe('TaskList Component', () => {
  beforeEach(() => {
    clearStorage()
    clearListeners()
    vi.clearAllMocks()
  })

  // ── Loading state ─────────────────────────────────────────────────

  it('shows loading indicator before data is fetched', () => {
    // Make storage.get hang forever so loading never resolves
    mockStorage.local.get.mockImplementation(() => new Promise(() => {}))
    const { unmount } = render(<TaskList />)
    expect(screen.getByTestId('tasks-loading')).toBeInTheDocument()
    unmount()
    // Restore default implementation
    mockStorage.local.get.mockImplementation(async (key: string) => ({
      [key]: storageData[key],
    }))
  })

  it('loading indicator contains "Loading" text', () => {
    mockStorage.local.get.mockImplementation(() => new Promise(() => {}))
    const { unmount } = render(<TaskList />)
    expect(screen.getByTestId('tasks-loading')).toHaveTextContent('Loading')
    unmount()
    mockStorage.local.get.mockImplementation(async (key: string) => ({
      [key]: storageData[key],
    }))
  })

  // ── Rendering – empty state ───────────────────────────────────────

  it('renders the task list container', async () => {
    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-list')).toBeInTheDocument()
    })
    unmount()
  })

  it('renders empty state message when no tasks', async () => {
    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('tasks-empty')).toBeInTheDocument()
    })
    expect(screen.getByTestId('tasks-empty')).toHaveTextContent(
      'No tasks yet'
    )
    unmount()
  })

  it('renders the add task input', async () => {
    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('add-task-input')).toBeInTheDocument()
    })
    unmount()
  })

  it('add task input has placeholder text', async () => {
    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('add-task-input')).toHaveAttribute(
        'placeholder',
        'Add a task...'
      )
    })
    unmount()
  })

  it('renders the add task button', async () => {
    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('add-task-button')).toBeInTheDocument()
    })
    unmount()
  })

  it('add task button has "Add" text', async () => {
    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('add-task-button')).toHaveTextContent('Add')
    })
    unmount()
  })

  it('renders the scroll area', async () => {
    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-scroll-area')).toBeInTheDocument()
    })
    unmount()
  })

  it('add task button is disabled when input is empty', async () => {
    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('add-task-button')).toBeDisabled()
    })
    unmount()
  })

  // ── Rendering – with tasks ────────────────────────────────────────

  it('renders task items from storage', async () => {
    seedTasks([
      { id: '1', text: 'Buy groceries', completed: false, isSelected: false },
      {
        id: '2',
        text: 'Write report',
        completed: false,
        isSelected: false,
      },
    ])

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-item-1')).toBeInTheDocument()
      expect(screen.getByTestId('task-item-2')).toBeInTheDocument()
    })
    unmount()
  })

  it('renders task text correctly', async () => {
    seedTasks([
      { id: '1', text: 'Buy groceries', completed: false, isSelected: false },
    ])

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-text-1')).toHaveTextContent(
        'Buy groceries'
      )
    })
    unmount()
  })

  it('renders checkbox for each task', async () => {
    seedTasks([
      { id: '1', text: 'Task 1', completed: false, isSelected: false },
    ])

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-checkbox-1')).toBeInTheDocument()
    })
    unmount()
  })

  it('renders delete button for each task', async () => {
    seedTasks([
      { id: '1', text: 'Task 1', completed: false, isSelected: false },
    ])

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-delete-1')).toBeInTheDocument()
    })
    unmount()
  })

  it('does not show empty state when tasks exist', async () => {
    seedTasks([
      { id: '1', text: 'Task 1', completed: false, isSelected: false },
    ])

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-items')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('tasks-empty')).not.toBeInTheDocument()
    unmount()
  })

  // ── Adding tasks ──────────────────────────────────────────────────

  it('adds a task when Add button is clicked', async () => {
    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('add-task-input')).toBeInTheDocument()
    })

    const input = screen.getByTestId('add-task-input')
    fireEvent.change(input, { target: { value: 'New task' } })
    fireEvent.click(screen.getByTestId('add-task-button'))

    await waitFor(() => {
      expect(screen.getByText('New task')).toBeInTheDocument()
    })
    unmount()
  })

  it('adds a task when Enter is pressed', async () => {
    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('add-task-input')).toBeInTheDocument()
    })

    const input = screen.getByTestId('add-task-input')
    fireEvent.change(input, { target: { value: 'Enter task' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('Enter task')).toBeInTheDocument()
    })
    unmount()
  })

  it('clears input after adding a task', async () => {
    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('add-task-input')).toBeInTheDocument()
    })

    const input = screen.getByTestId('add-task-input')
    fireEvent.change(input, { target: { value: 'Clear me' } })
    fireEvent.click(screen.getByTestId('add-task-button'))

    await waitFor(() => {
      expect(input).toHaveValue('')
    })
    unmount()
  })

  it('does not add empty tasks', async () => {
    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('add-task-input')).toBeInTheDocument()
    })

    const input = screen.getByTestId('add-task-input')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('tasks-empty')).toBeInTheDocument()
    })
    unmount()
  })

  it('removes empty state after adding first task', async () => {
    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('tasks-empty')).toBeInTheDocument()
    })

    const input = screen.getByTestId('add-task-input')
    fireEvent.change(input, { target: { value: 'First task' } })
    fireEvent.click(screen.getByTestId('add-task-button'))

    await waitFor(() => {
      expect(screen.queryByTestId('tasks-empty')).not.toBeInTheDocument()
    })
    unmount()
  })

  // ── Toggling tasks ────────────────────────────────────────────────

  it('toggles task completion when checkbox is clicked', async () => {
    seedTasks([
      { id: '1', text: 'Toggle me', completed: false, isSelected: false },
    ])

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-checkbox-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('task-checkbox-1'))

    await waitFor(() => {
      // Completed task text should have line-through styling
      expect(screen.getByTestId('task-text-1')).toHaveClass('line-through')
    })
    unmount()
  })

  it('completed task shows line-through text', async () => {
    seedTasks([
      { id: '1', text: 'Done task', completed: true, isSelected: false },
    ])

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-text-1')).toHaveClass('line-through')
    })
    unmount()
  })

  it('incomplete task does not have line-through', async () => {
    seedTasks([
      { id: '1', text: 'Not done', completed: false, isSelected: false },
    ])

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-text-1')).not.toHaveClass('line-through')
    })
    unmount()
  })

  // ── Deleting tasks ────────────────────────────────────────────────

  it('deletes a task when delete button is clicked', async () => {
    seedTasks([
      { id: '1', text: 'Delete me', completed: false, isSelected: false },
    ])

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-delete-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('task-delete-1'))

    await waitFor(() => {
      expect(screen.queryByTestId('task-item-1')).not.toBeInTheDocument()
    })
    unmount()
  })

  it('shows empty state after deleting last task', async () => {
    seedTasks([
      { id: '1', text: 'Last task', completed: false, isSelected: false },
    ])

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-item-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('task-delete-1'))

    await waitFor(() => {
      expect(screen.getByTestId('tasks-empty')).toBeInTheDocument()
    })
    unmount()
  })

  // ── Selecting tasks ───────────────────────────────────────────────

  it('selects a task when task text is clicked', async () => {
    seedTasks([
      { id: '1', text: 'Select me', completed: false, isSelected: false },
    ])

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-text-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('task-text-1'))

    await waitFor(() => {
      // Selected task text should have font-medium class
      expect(screen.getByTestId('task-text-1')).toHaveClass('font-medium')
    })
    unmount()
  })

  it('deselects a task when clicked again', async () => {
    seedTasks([
      { id: '1', text: 'Toggle select', completed: false, isSelected: true },
    ])

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-text-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('task-text-1'))

    await waitFor(() => {
      expect(screen.getByTestId('task-text-1')).not.toHaveClass('font-medium')
    })
    unmount()
  })

  it('selected task item has highlight styling', async () => {
    seedTasks([
      { id: '1', text: 'Selected', completed: false, isSelected: true },
    ])

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-item-1')).toBeInTheDocument()
    })

    // Selected item should have the highlight class
    expect(screen.getByTestId('task-item-1').className).toContain('bg-muted/70')
    unmount()
  })

  it('non-selected task item does not have highlight styling', async () => {
    seedTasks([
      { id: '1', text: 'Not selected', completed: false, isSelected: false },
    ])

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-item-1')).toBeInTheDocument()
    })

    expect(screen.getByTestId('task-item-1').className).not.toContain(
      'bg-muted/70'
    )
    unmount()
  })

  // ── Multiple tasks interaction ────────────────────────────────────

  it('renders multiple tasks correctly', async () => {
    seedTasks(makeTasks(5))

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByTestId(`task-item-${i}`)).toBeInTheDocument()
      }
    })
    unmount()
  })

  it('deleting one task preserves others', async () => {
    seedTasks(makeTasks(3))

    const { unmount } = render(<TaskList />)
    await waitFor(() => {
      expect(screen.getByTestId('task-item-2')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('task-delete-2'))

    await waitFor(() => {
      expect(screen.queryByTestId('task-item-2')).not.toBeInTheDocument()
      expect(screen.getByTestId('task-item-1')).toBeInTheDocument()
      expect(screen.getByTestId('task-item-3')).toBeInTheDocument()
    })
    unmount()
  })
})
