/**
 * WebSocket Context for real-time updates
 */

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import toast from 'react-hot-toast'

import { WebSocketMessage, WebSocketMessageType } from '../types/frontend'
import { useAuth } from './AuthContext'

// Types
export interface WebSocketContextType {
  socket: Socket | null
  connected: boolean
  connecting: boolean
  subscribe: (event: string, callback: (data: any) => void) => void
  unsubscribe: (event: string, callback?: (data: any) => void) => void
  send: (event: string, data: any) => void
  disconnect: () => void
  reconnect: () => void
  connectionError: string | null
}

// Context
const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

// Provider
interface WebSocketProviderProps {
  children: ReactNode
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { token, isAuthenticated } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxReconnectAttempts = 5
  const reconnectDelay = 1000 // Start with 1 second
  const reconnectBackoff = 1.5 // Multiply by this for each attempt

  // Initialize WebSocket connection
  const connect = () => {
    if (!isAuthenticated || !token || connecting) {
      return
    }

    setConnecting(true)
    setConnectionError(null)

    const socketUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001'

    const newSocket = io(socketUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
    })

    newSocket.on('connect', () => {
      console.log('WebSocket connected')
      setConnected(true)
      setConnecting(false)
      setConnectionError(null)
      toast.success('Real-time connection established')
    })

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      setConnected(false)
      setConnecting(false)

      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect automatically
        toast.error('Connection lost. Please refresh the page.')
      } else {
        // Try to reconnect
        scheduleReconnect()
      }
    })

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      setConnecting(false)
      setConnectionError(error.message)
      toast.error('Failed to connect to real-time updates')
    })

    // Handle authentication errors
    newSocket.on('auth_error', (error) => {
      console.error('WebSocket auth error:', error)
      setConnecting(false)
      setConnectionError('Authentication failed')
      toast.error('Real-time connection authentication failed')
    })

    setSocket(newSocket)
  }

  // Schedule reconnection with exponential backoff
  const scheduleReconnect = (attempt = 1) => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    if (attempt > maxReconnectAttempts) {
      setConnectionError('Unable to establish connection after multiple attempts')
      toast.error('Failed to establish real-time connection')
      return
    }

    const delay = reconnectDelay * Math.pow(reconnectBackoff, attempt - 1)

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`WebSocket reconnection attempt ${attempt}/${maxReconnectAttempts}`)
      connect()
      scheduleReconnect(attempt + 1)
    }, delay)
  }

  // Disconnect WebSocket
  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    if (socket) {
      socket.disconnect()
      setSocket(null)
    }

    setConnected(false)
    setConnecting(false)
  }

  // Manual reconnect
  const reconnect = () => {
    disconnect()
    setTimeout(() => connect(), 1000)
  }

  // Subscribe to events
  const subscribe = (event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback)
    }
  }

  // Unsubscribe from events
  const unsubscribe = (event: string, callback?: (data: any) => void) => {
    if (socket) {
      if (callback) {
        socket.off(event, callback)
      } else {
        socket.off(event)
      }
    }
  }

  // Send message
  const send = (event: string, data: any) => {
    if (socket && connected) {
      socket.emit(event, data)
    } else {
      console.warn('Cannot send message: WebSocket not connected')
    }
  }

  // Handle authentication changes
  useEffect(() => {
    if (isAuthenticated && token) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [isAuthenticated, token])

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && socket) {
        // Page is hidden, temporarily disconnect to save resources
        socket.disconnect()
      } else if (!document.hidden && isAuthenticated && token) {
        // Page is visible again, reconnect
        connect()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, token, socket])

  // Context value
  const contextValue: WebSocketContextType = {
    socket,
    connected,
    connecting,
    subscribe,
    unsubscribe,
    send,
    disconnect,
    reconnect,
    connectionError,
  }

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  )
}

// Hook
export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

// Hook for specific WebSocket events
export const useWebSocketSubscription = <T = any>(
  event: string,
  callback: (data: T) => void,
  deps: React.DependencyList = []
) => {
  const { subscribe, unsubscribe } = useWebSocket()

  useEffect(() => {
    subscribe(event, callback)

    return () => {
      unsubscribe(event, callback)
    }
  }, [event, callback, ...deps])
}

// Hook for connection status
export const useWebSocketStatus = () => {
  const { connected, connecting, connectionError, reconnect } = useWebSocket()

  return {
    connected,
    connecting,
    connectionError,
    reconnect,
    status: connected ? 'connected' : connecting ? 'connecting' : 'disconnected',
  }
}

export default WebSocketContext