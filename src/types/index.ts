/**
 * Shared TypeScript interfaces for the Pomodoro Task Timer extension.
 *
 * These types define the core domain models used by the popup UI,
 * background service worker, and chrome.storage layer.
 */

// ── Task ────────────────────────────────────────────────────────────

/**
 * Represents a single task in the task list.
 *
 * - `id`: unique identifier (e.g. crypto.randomUUID() or Date.now() string)
 * - `text`: user-visible task description
 * - `completed`: whether the task has been marked done
 * - `isSelected`: whether this task is the "active" task shown above the timer
 */
export interface Task {
  id: string
  text: string
  completed: boolean
  isSelected: boolean
}

// ── Timer State ─────────────────────────────────────────────────────

/**
 * UI-facing timer state.
 *
 * A lightweight projection of the full `TimerStorageState` kept in
 * chrome.storage.local. Components consume this shape for rendering
 * the countdown display, progress bar, and control buttons.
 *
 * - `mode`: current timer mode (work session or break)
 * - `timeLeft`: seconds remaining on the countdown
 * - `isRunning`: whether the timer is actively counting down
 */
export interface TimerState {
  mode: 'work' | 'break'
  timeLeft: number
  isRunning: boolean
}
