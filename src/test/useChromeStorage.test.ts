import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

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

// Install global chrome mock before module import
vi.stubGlobal('chrome', {
  storage: mockStorage,
})

// ── Import module under test (after chrome mock is set up) ──────────

const { useChromeStorage } = await import('../hooks/useChromeStorage')

// ── Helpers ─────────────────────────────────────────────────────────

function clearStorage() {
  for (const key of Object.keys(storageData)) {
    delete storageData[key]
  }
}

function clearListeners() {
  storageListeners.length = 0
}

/** Simulate an external chrome.storage.onChanged event */
function fireStorageChange(
  key: string,
  newValue: unknown,
  oldValue?: unknown
) {
  const changes: { [key: string]: chrome.storage.StorageChange } = {
    [key]: { newValue, oldValue },
  }
  for (const listener of [...storageListeners]) {
    listener(changes, 'local')
  }
}

// ── Tests ───────────────────────────────────────────────────────────

describe('useChromeStorage Hook', () => {
  beforeEach(() => {
    clearStorage()
    clearListeners()
    vi.clearAllMocks()
  })

  // ── Module Export ──────────────────────────────────────────────────

  describe('Module export', () => {
    it('exports useChromeStorage as a function', () => {
      expect(typeof useChromeStorage).toBe('function')
    })
  })

  // ── Initial State ─────────────────────────────────────────────────

  describe('Initial state', () => {
    it('returns the defaultValue initially', () => {
      const { result } = renderHook(() =>
        useChromeStorage('testKey', 'default')
      )
      const [value] = result.current
      expect(value).toBe('default')
    })

    it('starts with isLoading = true', () => {
      const { result } = renderHook(() =>
        useChromeStorage('testKey', 'default')
      )
      const [, , isLoading] = result.current
      expect(isLoading).toBe(true)
    })

    it('returns a tuple of [value, setValue, isLoading]', () => {
      const { result } = renderHook(() =>
        useChromeStorage('testKey', 'default')
      )
      expect(result.current).toHaveLength(3)
      expect(typeof result.current[0]).toBe('string')
      expect(typeof result.current[1]).toBe('function')
      expect(typeof result.current[2]).toBe('boolean')
    })
  })

  // ── Reading from storage ──────────────────────────────────────────

  describe('Reading from chrome.storage.local', () => {
    it('calls chrome.storage.local.get with the key on mount', () => {
      renderHook(() => useChromeStorage('myKey', 'fallback'))
      expect(mockStorage.local.get).toHaveBeenCalledWith('myKey')
    })

    it('updates value when storage has existing data', async () => {
      storageData['myKey'] = 'stored-value'

      const { result } = renderHook(() =>
        useChromeStorage('myKey', 'fallback')
      )

      await waitFor(() => {
        expect(result.current[0]).toBe('stored-value')
      })
    })

    it('keeps defaultValue when storage key is undefined', async () => {
      // storageData['myKey'] is not set

      const { result } = renderHook(() =>
        useChromeStorage('myKey', 'fallback')
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false) // isLoading = false
      })

      expect(result.current[0]).toBe('fallback')
    })

    it('sets isLoading to false after reading storage', async () => {
      const { result } = renderHook(() =>
        useChromeStorage('myKey', 'fallback')
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })
    })

    it('works with object values', async () => {
      const obj = { name: 'test', count: 42 }
      storageData['objKey'] = obj

      const { result } = renderHook(() =>
        useChromeStorage('objKey', { name: '', count: 0 })
      )

      await waitFor(() => {
        expect(result.current[0]).toEqual(obj)
      })
    })

    it('works with array values', async () => {
      const arr = [1, 2, 3]
      storageData['arrKey'] = arr

      const { result } = renderHook(() =>
        useChromeStorage<number[]>('arrKey', [])
      )

      await waitFor(() => {
        expect(result.current[0]).toEqual(arr)
      })
    })

    it('works with boolean values', async () => {
      storageData['boolKey'] = true

      const { result } = renderHook(() =>
        useChromeStorage('boolKey', false)
      )

      await waitFor(() => {
        expect(result.current[0]).toBe(true)
      })
    })

    it('works with numeric values', async () => {
      storageData['numKey'] = 1500

      const { result } = renderHook(() =>
        useChromeStorage('numKey', 0)
      )

      await waitFor(() => {
        expect(result.current[0]).toBe(1500)
      })
    })
  })

  // ── Writing to storage ────────────────────────────────────────────

  describe('Writing to chrome.storage.local (setValue)', () => {
    it('calls chrome.storage.local.set with the key and value', async () => {
      const { result } = renderHook(() =>
        useChromeStorage('writeKey', 'initial')
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      act(() => {
        result.current[1]('updated')
      })

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        writeKey: 'updated',
      })
    })

    it('optimistically updates the local value', async () => {
      const { result } = renderHook(() =>
        useChromeStorage('writeKey', 'initial')
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      act(() => {
        result.current[1]('optimistic')
      })

      expect(result.current[0]).toBe('optimistic')
    })

    it('supports a callback updater function', async () => {
      storageData['counterKey'] = 10

      const { result } = renderHook(() =>
        useChromeStorage('counterKey', 0)
      )

      await waitFor(() => {
        expect(result.current[0]).toBe(10)
      })

      act(() => {
        result.current[1]((prev) => prev + 1)
      })

      expect(result.current[0]).toBe(11)
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        counterKey: 11,
      })
    })

    it('updates objects correctly', async () => {
      const { result } = renderHook(() =>
        useChromeStorage('objWriteKey', { a: 1, b: 2 })
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      act(() => {
        result.current[1]({ a: 10, b: 20 })
      })

      expect(result.current[0]).toEqual({ a: 10, b: 20 })
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        objWriteKey: { a: 10, b: 20 },
      })
    })

    it('persists array values to storage', async () => {
      const { result } = renderHook(() =>
        useChromeStorage<string[]>('arrWriteKey', [])
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      act(() => {
        result.current[1](['task1', 'task2'])
      })

      expect(result.current[0]).toEqual(['task1', 'task2'])
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        arrWriteKey: ['task1', 'task2'],
      })
    })
  })

  // ── Listening for external changes (chrome.storage.onChanged) ─────

  describe('External storage changes (chrome.storage.onChanged)', () => {
    it('registers a listener on chrome.storage.onChanged', () => {
      renderHook(() => useChromeStorage('listenKey', 'init'))
      expect(mockStorage.onChanged.addListener).toHaveBeenCalled()
    })

    it('updates value when an external change occurs', async () => {
      const { result } = renderHook(() =>
        useChromeStorage('extKey', 'init')
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      act(() => {
        fireStorageChange('extKey', 'external-update')
      })

      expect(result.current[0]).toBe('external-update')
    })

    it('ignores changes for other keys', async () => {
      const { result } = renderHook(() =>
        useChromeStorage('myKey', 'init')
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      act(() => {
        fireStorageChange('otherKey', 'something')
      })

      expect(result.current[0]).toBe('init')
    })

    it('ignores changes from non-local storage areas', async () => {
      const { result } = renderHook(() =>
        useChromeStorage('myKey', 'init')
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      // Directly fire with 'sync' area
      act(() => {
        const changes = { myKey: { newValue: 'sync-value' } }
        for (const listener of [...storageListeners]) {
          listener(changes, 'sync')
        }
      })

      expect(result.current[0]).toBe('init')
    })

    it('removes the listener on unmount', () => {
      const { unmount } = renderHook(() =>
        useChromeStorage('cleanKey', 'init')
      )

      const listenerCountBefore = mockStorage.onChanged.removeListener.mock.calls.length

      unmount()

      expect(mockStorage.onChanged.removeListener.mock.calls.length).toBeGreaterThan(
        listenerCountBefore
      )
    })
  })

  // ── Cleanup on unmount ────────────────────────────────────────────

  describe('Cleanup on unmount', () => {
    it('cancels pending storage reads on unmount', async () => {
      // Make storage.get return a delayed promise
      let resolveGet: ((val: Record<string, unknown>) => void) | undefined
      mockStorage.local.get.mockImplementationOnce(
        () =>
          new Promise<Record<string, unknown>>((resolve) => {
            resolveGet = resolve
          })
      )

      const { result, unmount } = renderHook(() =>
        useChromeStorage('cancelKey', 'default')
      )

      // Unmount before the storage read completes
      unmount()

      // Now resolve the delayed get — the state should NOT update
      act(() => {
        resolveGet?.({ cancelKey: 'late-value' })
      })

      // Value should remain the default since the effect was cancelled
      expect(result.current[0]).toBe('default')
    })
  })

  // ── Key change behavior ───────────────────────────────────────────

  describe('Key change behavior', () => {
    it('re-reads storage when the key changes', async () => {
      storageData['key1'] = 'value1'
      storageData['key2'] = 'value2'

      const { result, rerender } = renderHook(
        ({ key }: { key: string }) => useChromeStorage(key, 'default'),
        { initialProps: { key: 'key1' } }
      )

      await waitFor(() => {
        expect(result.current[0]).toBe('value1')
      })

      rerender({ key: 'key2' })

      await waitFor(() => {
        expect(result.current[0]).toBe('value2')
      })
    })
  })

  // ── Return value stability ────────────────────────────────────────

  describe('Return value stability', () => {
    it('setValue function reference is stable across re-renders', async () => {
      const { result, rerender } = renderHook(() =>
        useChromeStorage('stableKey', 'init')
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      const setValueRef1 = result.current[1]

      rerender()

      const setValueRef2 = result.current[1]

      expect(setValueRef1).toBe(setValueRef2)
    })
  })

  // ── Edge cases ────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('handles null values from storage', async () => {
      storageData['nullKey'] = null

      const { result } = renderHook(() =>
        useChromeStorage<string | null>('nullKey', 'default')
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      // null is a valid stored value, should be used (not undefined)
      expect(result.current[0]).toBeNull()
    })

    it('handles empty string from storage', async () => {
      storageData['emptyKey'] = ''

      const { result } = renderHook(() =>
        useChromeStorage('emptyKey', 'default')
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      expect(result.current[0]).toBe('')
    })

    it('handles zero from storage', async () => {
      storageData['zeroKey'] = 0

      const { result } = renderHook(() =>
        useChromeStorage('zeroKey', 99)
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      expect(result.current[0]).toBe(0)
    })

    it('handles false from storage', async () => {
      storageData['falseKey'] = false

      const { result } = renderHook(() =>
        useChromeStorage('falseKey', true)
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      expect(result.current[0]).toBe(false)
    })

    it('multiple setValue calls update sequentially', async () => {
      const { result } = renderHook(() =>
        useChromeStorage('seqKey', 0)
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      act(() => {
        result.current[1](1)
      })

      act(() => {
        result.current[1](2)
      })

      act(() => {
        result.current[1](3)
      })

      expect(result.current[0]).toBe(3)
    })

    it('callback updater uses the latest value', async () => {
      const { result } = renderHook(() =>
        useChromeStorage('cbKey', 0)
      )

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      act(() => {
        result.current[1]((prev) => prev + 1)
        result.current[1]((prev) => prev + 1)
        result.current[1]((prev) => prev + 1)
      })

      expect(result.current[0]).toBe(3)
    })
  })
})
