/**
 * Notification Context
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import toast from 'react-hot-toast'

import { Notification, NotificationType, WebSocketMessage } from '../types/frontend'
import { useWebSocket } from './WebSocketContext'
import { useAuth } from './AuthContext'

// Types
export interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  removeNotification: (id: string) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
  getNotifications: (type?: NotificationType) => Notification[]
}

interface NotificationSettings {
  desktop: boolean
  email: boolean
  security: boolean
  tasks: boolean
  performance: boolean
  github: boolean
}

// Context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

// Provider
interface NotificationProviderProps {
  children: ReactNode
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [settings, setSettings] = useState<NotificationSettings>({
    desktop: true,
    email: false,
    security: true,
    tasks: true,
    performance: false,
    github: true,
  })

  const { user } = useAuth()
  const { subscribe } = useWebSocket()

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length

  // Add notification
  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: generateNotificationId(),
      timestamp: new Date(),
      read: false,
    }

    setNotifications(prev => [newNotification, ...prev])

    // Show toast notification if enabled
    if (settings.desktop) {
      showToastNotification(newNotification)
    }

    // Send push notification if supported and enabled
    if ('Notification' in window && Notification.permission === 'granted' && settings.desktop) {
      sendPushNotification(newNotification)
    }
  }

  // Remove notification
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  // Mark as read
  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    )
  }

  // Clear all notifications
  const clearAll = () => {
    setNotifications([])
  }

  // Get notifications by type
  const getNotifications = (type?: NotificationType): Notification[] => {
    if (!type) return notifications
    return notifications.filter(n => n.type === type)
  }

  // Generate unique notification ID
  const generateNotificationId = (): string => {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Show toast notification
  const showToastNotification = (notification: Notification) => {
    const toastOptions: any = {
      duration: notification.duration || 4000,
      icon: getNotificationIcon(notification.type),
    }

    if (notification.action) {
      toastOptions.onClick = () => {
        notification.action.onClick()
      }
    }

    toast(notification.title, toastOptions)
  }

  // Get notification icon
  const getNotificationIcon = (type: NotificationType): string => {
    switch (type) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'info':
        return 'ℹ️'
      default:
        return '📢'
    }
  }

  // Send push notification
  const sendPushNotification = (notification: Notification) => {
    try {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.type === 'error' || notification.type === 'warning',
      })
    } catch (error) {
      console.error('Push notification failed:', error)
    }
  }

  // Request notification permission
  const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }

    return false
  }

  // Handle WebSocket notifications
  useEffect(() => {
    const handleNotification = (message: WebSocketMessage) => {
      if (message.type === 'system-notification' || message.type === 'security-alert') {
        const notification = message.payload as Omit<Notification, 'id' | 'timestamp' | 'read'>

        // Check if notification type is enabled in settings
        const typeEnabled = settings[notification.type as keyof NotificationSettings] as boolean

        if (typeEnabled) {
          addNotification(notification)
        }
      }
    }

    subscribe('system-notification', handleNotification)
    subscribe('security-alert', handleNotification)
    subscribe('task-update', handleNotification)
    subscribe('agent-status-update', handleNotification)

    return () => {
      // Cleanup handled by WebSocketProvider
    }
  }, [subscribe, settings])

  // Request notification permission on mount
  useEffect(() => {
    if (settings.desktop) {
      requestNotificationPermission()
    }
  }, [settings.desktop])

  // Store notifications in localStorage for persistence
  useEffect(() => {
    if (notifications.length > 0) {
      localStorage.setItem('notifications', JSON.stringify(notifications))
    }
  }, [notifications])

  // Load notifications from localStorage on mount
  useEffect(() => {
    const storedNotifications = localStorage.getItem('notifications')
    if (storedNotifications) {
      try {
        const parsed = JSON.parse(storedNotifications)
        // Only keep notifications from the last 7 days
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const validNotifications = parsed.filter((n: Notification) =>
          new Date(n.timestamp) > sevenDaysAgo
        )

        setNotifications(validNotifications)
      } catch (error) {
        console.error('Failed to parse stored notifications:', error)
      }
    }
  }, [])

  // Update settings based on user preferences
  useEffect(() => {
    if (user?.preferences?.notifications) {
      setSettings(user.preferences.notifications)
    }
  }, [user])

  // Context value
  const contextValue: NotificationContextType = {
    notifications,
    unreadCount,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    getNotifications,
  }

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  )
}

// Hook
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

// Hook for unread count
export const useUnreadCount = (): number => {
  const { unreadCount } = useNotifications()
  return unreadCount
}

// Hook for notifications by type
export const useNotificationsByType = (type?: NotificationType): Notification[] => {
  const { getNotifications } = useNotifications()
  return getNotifications(type)
}

export default NotificationContext