// The one place screens import the API from.
// Set VITE_USE_MOCK_API=false in .env to switch from the fake backend to the real Django API.
import { mockApi } from './mock'
import { realApi } from './real'
import type { GasgoApi } from './types'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false'

export const api: GasgoApi = USE_MOCK ? mockApi : realApi

export { ApiError, errorMessage } from './types'
