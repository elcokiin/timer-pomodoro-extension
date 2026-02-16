import { useCallback } from 'react'
import { useChromeStorage } from './useChromeStorage'
import type { Task } from '../types/index'

/**
 * Custom React hook for managing the task list.
 *
 * Persists tasks to `chrome.storage.local` under the key `'tasks'`
 * and provides CRUD operations: add, toggle, delete, and select.
 *
 * @returns { tasks, isLoading, addTask, toggleTask, deleteTask, selectTask }
 */
export function useTasks() {
  const [tasks, setTasks, isLoading] = useChromeStorage<Task[]>('tasks', [])

  /** Add a new task with the given text. */
  const addTask = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      const newTask: Task = {
        id: Date.now().toString(),
        text: trimmed,
        completed: false,
        isSelected: false,
      }

      setTasks((prev) => [...prev, newTask])
    },
    [setTasks]
  )

  /** Toggle the completed state of a task by ID. */
  const toggleTask = useCallback(
    (id: string) => {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === id ? { ...task, completed: !task.completed } : task
        )
      )
    },
    [setTasks]
  )

  /** Delete a task by ID. */
  const deleteTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.filter((task) => task.id !== id))
    },
    [setTasks]
  )

  /**
   * Select a task as the "active" task (shown above the timer).
   * Only one task can be selected at a time — selecting a task
   * deselects all others. Selecting an already-selected task
   * deselects it.
   */
  const selectTask = useCallback(
    (id: string) => {
      setTasks((prev) =>
        prev.map((task) => ({
          ...task,
          isSelected: task.id === id ? !task.isSelected : false,
        }))
      )
    },
    [setTasks]
  )

  return { tasks, isLoading, addTask, toggleTask, deleteTask, selectTask }
}
