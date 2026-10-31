// localStorage can throw (private browsing, blocked storage), so every access is wrapped.
import type { StateStorage } from 'zustand/middleware'

export const safeStorage: StateStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}
