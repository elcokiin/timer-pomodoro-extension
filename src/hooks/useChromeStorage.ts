import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * A generic custom React hook for real-time two-way synchronization
 * between the extension UI and chrome.storage.local.
 *
 * - Reads the initial value from chrome.storage.local on mount.
 * - Listens to `chrome.storage.onChanged` for external updates
 *   (e.g. from the background script) and re-renders automatically.
 * - Provides a `setValue` function to write back to storage.
 *
 * @param key - The storage key to read/write.
 * @param defaultValue - The fallback value when the key is not yet set.
 * @returns A tuple of [value, setValue, isLoading].
 */
export function useChromeStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValueState] = useState<T>(defaultValue)
  const [isLoading, setIsLoading] = useState(true)

  // Keep a ref to the latest value for use inside the updater function
  // when a callback form of setValue is used.
  const valueRef = useRef<T>(defaultValue)

  // Sync ref with latest value inside an effect to comply with React rules
  // (refs must not be written during render).
  useEffect(() => {
    valueRef.current = value
  }, [value])

  // ── Initial read from storage ──────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    chrome.storage.local.get(key).then((result) => {
      if (cancelled) return

      if (result[key] !== undefined) {
        setValueState(result[key] as T)
        valueRef.current = result[key] as T
      }
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [key])

  // ── Listen for external changes ────────────────────────────────────

  useEffect(() => {
    const handleChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== 'local') return
      if (!(key in changes)) return

      const change = changes[key]
      if (change.newValue !== undefined) {
        setValueState(change.newValue as T)
        valueRef.current = change.newValue as T
      }
    }

    chrome.storage.onChanged.addListener(handleChange)
    return () => {
      chrome.storage.onChanged.removeListener(handleChange)
    }
  }, [key])

  // ── Write to storage ───────────────────────────────────────────────

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const resolved =
        typeof newValue === 'function'
          ? (newValue as (prev: T) => T)(valueRef.current)
          : newValue

      // Optimistically update local state
      setValueState(resolved)
      valueRef.current = resolved

      // Persist to chrome.storage.local
      chrome.storage.local.set({ [key]: resolved })
    },
    [key]
  )

  return [value, setValue, isLoading]
}
