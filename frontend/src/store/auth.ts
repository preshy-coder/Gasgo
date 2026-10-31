import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage } from '../lib/storage'
import type { User } from '../types'

interface AuthState {
  access: string | null
  refresh: string | null
  user: User | null
  setSession: (access: string, refresh: string, user: User) => void
  setAccess: (access: string) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      access: null,
      refresh: null,
      user: null,
      setSession: (access, refresh, user) => set({ access, refresh, user }),
      setAccess: (access) => set({ access }),
      setUser: (user) => set({ user }),
      logout: () => set({ access: null, refresh: null, user: null }),
    }),
    { name: 'gasgo-auth', storage: createJSONStorage(() => safeStorage) },
  ),
)
