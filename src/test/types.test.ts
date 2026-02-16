import { describe, it, expect } from 'vitest'
import type { Task, TimerState } from '../types/index'

// ── Type-level helpers ──────────────────────────────────────────────

/**
 * These tests validate that the TypeScript interfaces exported from
 * src/types/index.ts have the expected shape at runtime.  Because
 * interfaces are erased at compile time we create conforming objects
 * and assert their properties.
 */

describe('TypeScript interfaces – src/types/index.ts', () => {
  // ── Task interface ──────────────────────────────────────────────

  describe('Task interface', () => {
    const task: Task = {
      id: 'abc-123',
      text: 'Write unit tests',
      completed: false,
      isSelected: true,
    }

    it('has an id property of type string', () => {
      expect(typeof task.id).toBe('string')
    })

    it('has a text property of type string', () => {
      expect(typeof task.text).toBe('string')
    })

    it('has a completed property of type boolean', () => {
      expect(typeof task.completed).toBe('boolean')
    })

    it('has an isSelected property of type boolean', () => {
      expect(typeof task.isSelected).toBe('boolean')
    })

    it('accepts a completed task', () => {
      const done: Task = {
        id: '1',
        text: 'Completed task',
        completed: true,
        isSelected: false,
      }
      expect(done.completed).toBe(true)
      expect(done.isSelected).toBe(false)
    })

    it('accepts a selected task', () => {
      const selected: Task = {
        id: '2',
        text: 'Active task',
        completed: false,
        isSelected: true,
      }
      expect(selected.isSelected).toBe(true)
    })

    it('contains exactly four keys', () => {
      expect(Object.keys(task)).toHaveLength(4)
      expect(Object.keys(task)).toEqual(
        expect.arrayContaining(['id', 'text', 'completed', 'isSelected'])
      )
    })
  })

  // ── TimerState interface ────────────────────────────────────────

  describe('TimerState interface', () => {
    const timerState: TimerState = {
      mode: 'work',
      timeLeft: 1500,
      isRunning: false,
    }

    it('has a mode property', () => {
      expect(timerState.mode).toBeDefined()
    })

    it('mode accepts "work"', () => {
      const state: TimerState = { ...timerState, mode: 'work' }
      expect(state.mode).toBe('work')
    })

    it('mode accepts "break"', () => {
      const state: TimerState = { ...timerState, mode: 'break' }
      expect(state.mode).toBe('break')
    })

    it('has a timeLeft property of type number', () => {
      expect(typeof timerState.timeLeft).toBe('number')
    })

    it('timeLeft can be zero', () => {
      const state: TimerState = { ...timerState, timeLeft: 0 }
      expect(state.timeLeft).toBe(0)
    })

    it('has an isRunning property of type boolean', () => {
      expect(typeof timerState.isRunning).toBe('boolean')
    })

    it('isRunning can be true', () => {
      const state: TimerState = { ...timerState, isRunning: true }
      expect(state.isRunning).toBe(true)
    })

    it('contains exactly three keys', () => {
      expect(Object.keys(timerState)).toHaveLength(3)
      expect(Object.keys(timerState)).toEqual(
        expect.arrayContaining(['mode', 'timeLeft', 'isRunning'])
      )
    })
  })

  // ── Module exports ──────────────────────────────────────────────

  describe('Module exports', () => {
    it('exports Task type (verified via import compilation)', () => {
      // If this file compiles, Task is exported correctly.
      const t: Task = {
        id: '1',
        text: 'test',
        completed: false,
        isSelected: false,
      }
      expect(t).toBeDefined()
    })

    it('exports TimerState type (verified via import compilation)', () => {
      // If this file compiles, TimerState is exported correctly.
      const s: TimerState = {
        mode: 'work',
        timeLeft: 0,
        isRunning: false,
      }
      expect(s).toBeDefined()
    })
  })

  // ── Compatibility with background TimerStorageState ────────────

  describe('TimerState is a subset of TimerStorageState', () => {
    it('TimerStorageState can be narrowed to TimerState', () => {
      // Simulate a TimerStorageState-like object (from background script)
      const storageState = {
        duration: 1500,
        timeLeft: 900,
        isRunning: true,
        startTime: Date.now(),
        mode: 'work' as const,
      }

      // Extract only TimerState fields
      const uiState: TimerState = {
        mode: storageState.mode,
        timeLeft: storageState.timeLeft,
        isRunning: storageState.isRunning,
      }

      expect(uiState.mode).toBe('work')
      expect(uiState.timeLeft).toBe(900)
      expect(uiState.isRunning).toBe(true)
      expect(Object.keys(uiState)).toHaveLength(3)
    })
  })
})
