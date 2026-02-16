import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTasks } from '@/hooks/useTasks'

/**
 * TaskList – a scrollable list of tasks with Checkbox toggles,
 * a "Delete" action, and an input to add new tasks.
 *
 * Uses `useTasks` hook to persist tasks to chrome.storage.local.
 * Wrapped in a shadcn ScrollArea for overflow handling.
 */
export function TaskList() {
  const { tasks, isLoading, addTask, toggleTask, deleteTask, selectTask } =
    useTasks()
  const [newTaskText, setNewTaskText] = useState('')

  if (isLoading) {
    return (
      <div
        data-testid="tasks-loading"
        className="flex items-center justify-center py-12"
      >
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    )
  }

  const handleAddTask = () => {
    const trimmed = newTaskText.trim()
    if (!trimmed) return
    addTask(trimmed)
    setNewTaskText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddTask()
    }
  }

  return (
    <div data-testid="task-list" className="flex flex-col gap-3 w-full px-4 py-4">
      {/* Add task input */}
      <div data-testid="add-task-section" className="flex items-center gap-2">
        <Input
          data-testid="add-task-input"
          type="text"
          placeholder="Add a task..."
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm"
        />
        <Button
          data-testid="add-task-button"
          variant="outline"
          size="sm"
          onClick={handleAddTask}
          disabled={!newTaskText.trim()}
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      {/* Task list in ScrollArea */}
      <ScrollArea data-testid="task-scroll-area" className="max-h-[280px] w-full">
        {tasks.length === 0 ? (
          <p
            data-testid="tasks-empty"
            className="text-muted-foreground text-sm text-center py-8"
          >
            No tasks yet. Add one above!
          </p>
        ) : (
          <div data-testid="task-items" className="flex flex-col gap-1">
            {tasks.map((task) => (
              <div
                key={task.id}
                data-testid={`task-item-${task.id}`}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 group hover:bg-muted/50 ${
                  task.isSelected ? 'bg-muted/70 ring-1 ring-primary/30' : ''
                }`}
              >
                {/* Checkbox toggle */}
                <Checkbox
                  data-testid={`task-checkbox-${task.id}`}
                  checked={task.completed}
                  onCheckedChange={() => toggleTask(task.id)}
                />

                {/* Task text – click to select */}
                <button
                  data-testid={`task-text-${task.id}`}
                  type="button"
                  className={`flex-1 text-sm text-left cursor-pointer truncate ${
                    task.completed
                      ? 'line-through text-muted-foreground'
                      : 'text-foreground'
                  } ${task.isSelected ? 'font-medium' : ''}`}
                  onClick={() => selectTask(task.id)}
                  title={task.isSelected ? 'Deselect task' : 'Select as active task'}
                >
                  {task.text}
                </button>

                {/* Delete button */}
                <Button
                  data-testid={`task-delete-${task.id}`}
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={() => deleteTask(task.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
