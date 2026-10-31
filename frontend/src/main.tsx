import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from './api'
import App from './App'
import './index.css'

// Hash URLs (/#/orders/12) are only for hosting the app as a single preview file.
// Normal development and production use clean URLs (/orders/12).
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't retry "not found" / "forbidden" style errors, only network blips and server errors.
      retry: (count, err) => (err instanceof ApiError && err.status < 500 ? false : count < 2),
      refetchOnWindowFocus: true,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <App />
      </Router>
    </QueryClientProvider>
  </StrictMode>,
)
