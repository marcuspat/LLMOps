/**
 * Main application entry point
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { WebSocketProvider } from './contexts/WebSocketContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AccessibilityProvider } from './contexts/AccessibilityContext'

import './index.css'

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
})

// Initialize application
const initApp = async () => {
  // Remove initial loader
  const loader = document.querySelector('.initial-loader')
  if (loader) {
    loader.remove()
  }

  // Add loaded class to root for fade-in effect
  const root = document.getElementById('root')
  if (root) {
    root.classList.add('loaded')
  }

  // Initialize service worker if available
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      console.log('Service Worker registered:', registration)
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  }

  // Initialize error tracking
  if (import.meta.env.PROD) {
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error)
      // Send to error tracking service
    })

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason)
      // Send to error tracking service
    })
  }
}

// Render application
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <AccessibilityProvider>
              <AuthProvider>
                <WebSocketProvider>
                  <NotificationProvider>
                    <App />
                    <Toaster
                      position="top-right"
                      toastOptions={{
                        duration: 4000,
                        style: {
                          background: 'var(--toast-bg)',
                          color: 'var(--toast-color)',
                          border: '1px solid var(--toast-border)',
                        },
                        success: {
                          iconTheme: {
                            primary: '#22c55e',
                            secondary: '#ffffff',
                          },
                        },
                        error: {
                          iconTheme: {
                            primary: '#ef4444',
                            secondary: '#ffffff',
                          },
                        },
                      }}
                    />
                  </NotificationProvider>
                </WebSocketProvider>
              </AuthProvider>
            </AccessibilityProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)

// Initialize app after render
initApp().catch(console.error)

// Handle development hot module replacement
if (import.meta.hot) {
  import.meta.hot.accept()
}