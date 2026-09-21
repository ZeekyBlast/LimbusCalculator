import type { StateStorage } from 'zustand/middleware'

/** In-memory StateStorage for tests and for environments without localStorage. */
export function memoryStorage(): StateStorage {
  const map = new Map<string, string>()
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value) },
    removeItem: key => { map.delete(key) },
  }
}

/**
 * localStorage when the browser allows it (private windows can throw), otherwise memory.
 *
 * Deviation from the brief: guards on `typeof window` rather than `typeof localStorage`. Under
 * Node 22+, `localStorage` is a lazily-defined global whose getter itself prints an
 * ExperimentalWarning to stderr the moment it's touched (even via `typeof`), which would make
 * every test run print a warning. `window` is not defined in Node's test environment, so this
 * check never touches the `localStorage` getter there, and still finds real localStorage in a
 * browser.
 */
export function defaultStorage(): StateStorage {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.getItem('limbus.probe')
      return window.localStorage
    }
  } catch {
    // fall through
  }
  return memoryStorage()
}
