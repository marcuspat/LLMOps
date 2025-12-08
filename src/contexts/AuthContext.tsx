/**
 * Authentication Context
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { User } from '../types/frontend'
import { authApi } from '../services/auth'

// Types
export interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  updateUser: (userData: Partial<User>) => Promise<void>
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
}

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_AUTH'; payload: { user: User; token: string } }
  | { type: 'CLEAR_AUTH' }
  | { type: 'UPDATE_USER'; payload: Partial<User> }

// Initial state
const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('auth_token'),
  isAuthenticated: false,
  loading: true,
}

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      }
    case 'SET_AUTH':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
      }
    case 'CLEAR_AUTH':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
      }
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      }
    default:
      return state
  }
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider
interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('auth_token')
      if (token) {
        try {
          // Verify token and get user data
          const response = await authApi.verifyToken(token)
          if (response.success && response.data) {
            dispatch({
              type: 'SET_AUTH',
              payload: {
                user: response.data.user,
                token: token,
              },
            })
          } else {
            // Invalid token, clear it
            localStorage.removeItem('auth_token')
            dispatch({ type: 'CLEAR_AUTH' })
          }
        } catch (error) {
          console.error('Auth initialization error:', error)
          localStorage.removeItem('auth_token')
          dispatch({ type: 'CLEAR_AUTH' })
        }
      } else {
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }

    initializeAuth()
  }, [])

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await authApi.login({ email, password })
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Login failed')
      }
      return response.data
    },
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token)
      dispatch({
        type: 'SET_AUTH',
        payload: {
          user: data.user,
          token: data.token,
        },
      })
      toast.success(`Welcome back, ${data.user.username}!`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
      dispatch({ type: 'CLEAR_AUTH' })
    },
  })

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await authApi.logout()
    },
    onSuccess: () => {
      localStorage.removeItem('auth_token')
      dispatch({ type: 'CLEAR_AUTH' })
      toast.success('Logged out successfully')
    },
    onError: (error) => {
      console.error('Logout error:', error)
      // Clear local auth state even if server logout fails
      localStorage.removeItem('auth_token')
      dispatch({ type: 'CLEAR_AUTH' })
    },
  })

  // Refresh token mutation
  const refreshTokenMutation = useMutation({
    mutationFn: async () => {
      const currentToken = localStorage.getItem('auth_token')
      if (!currentToken) {
        throw new Error('No token to refresh')
      }
      const response = await authApi.refreshToken(currentToken)
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Token refresh failed')
      }
      return response.data
    },
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token)
      dispatch({
        type: 'SET_AUTH',
        payload: {
          user: data.user,
          token: data.token,
        },
      })
    },
    onError: (error) => {
      console.error('Token refresh error:', error)
      localStorage.removeItem('auth_token')
      dispatch({ type: 'CLEAR_AUTH' })
      toast.error('Session expired. Please login again.')
    },
  })

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (userData: Partial<User>) => {
      const response = await authApi.updateProfile(userData)
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Profile update failed')
      }
      return response.data
    },
    onSuccess: (userData) => {
      dispatch({
        type: 'UPDATE_USER',
        payload: userData,
      })
      toast.success('Profile updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Token refresh effect
  useEffect(() => {
    if (!state.token || !state.isAuthenticated) return

    // Set up token refresh interval (refresh every 15 minutes)
    const refreshInterval = setInterval(async () => {
      try {
        await refreshTokenMutation.mutateAsync()
      } catch (error) {
        console.error('Auto token refresh failed:', error)
      }
    }, 15 * 60 * 1000) // 15 minutes

    return () => clearInterval(refreshInterval)
  }, [state.token, state.isAuthenticated])

  // Context value
  const contextValue: AuthContextType = {
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    loading: state.loading,
    login: async (email: string, password: string) => {
      await loginMutation.mutateAsync({ email, password })
    },
    logout: () => {
      logoutMutation.mutate()
    },
    refreshToken: async () => {
      await refreshTokenMutation.mutateAsync()
    },
    updateUser: async (userData: Partial<User>) => {
      await updateUserMutation.mutateAsync(userData)
    },
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Higher-order component for protected routes
export interface WithAuthProps {
  children: ReactNode
  fallback?: ReactNode
}

export const WithAuth: React.FC<WithAuthProps> = ({ children, fallback }) => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return fallback || <div>Loading...</div>
  }

  if (!isAuthenticated) {
    return fallback || <div>Please log in to continue.</div>
  }

  return <>{children}</>
}

export default AuthContext