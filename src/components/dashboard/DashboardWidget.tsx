/**
 * Dashboard Widget Component
 */

import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface DashboardWidgetProps {
  title: string
  value: number
  total: number
  icon: React.ReactNode
  color: 'primary' | 'success' | 'warning' | 'error' | 'info'
  trend?: 'up' | 'down' | 'neutral'
  loading?: boolean
  subtitle?: string
}

const colorClasses = {
  primary: {
    bg: 'bg-primary-100 dark:bg-primary-900',
    text: 'text-primary-600 dark:text-primary-400',
    icon: 'text-primary-500',
    border: 'border-primary-200 dark:border-primary-800',
  },
  success: {
    bg: 'bg-success-100 dark:bg-success-900',
    text: 'text-success-600 dark:text-success-400',
    icon: 'text-success-500',
    border: 'border-success-200 dark:border-success-800',
  },
  warning: {
    bg: 'bg-warning-100 dark:bg-warning-900',
    text: 'text-warning-600 dark:text-warning-400',
    icon: 'text-warning-500',
    border: 'border-warning-200 dark:border-warning-800',
  },
  error: {
    bg: 'bg-error-100 dark:bg-error-900',
    text: 'text-error-600 dark:text-error-400',
    icon: 'text-error-500',
    border: 'border-error-200 dark:border-error-800',
  },
  info: {
    bg: 'bg-info-100 dark:bg-info-900',
    text: 'text-info-600 dark:text-info-400',
    icon: 'text-info-500',
    border: 'border-info-200 dark:border-info-800',
  },
}

const getTrendIcon = (trend?: 'up' | 'down' | 'neutral') => {
  switch (trend) {
    case 'up':
      return <TrendingUp className="w-4 h-4 text-success-500" />
    case 'down':
      return <TrendingDown className="w-4 h-4 text-error-500" />
    case 'neutral':
    default:
      return <Minus className="w-4 h-4 text-neutral-500" />
  }
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  title,
  value,
  total,
  icon,
  color,
  trend,
  loading = false,
  subtitle,
}) => {
  const colors = colorClasses[color]
  const percentage = total > 0 ? (value / total) * 100 : 0

  if (loading) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-2" />
            <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-16 mb-2" />
            <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-32" />
          </div>
          <div className="w-12 h-12 bg-neutral-200 dark:bg-neutral-700 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="card p-6 hover:shadow-medium transition-shadow"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              {title}
            </p>
            {trend && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                {getTrendIcon(trend)}
              </motion.div>
            )}
          </div>

          <div className="mt-2 flex items-baseline">
            <p className={`text-2xl font-semibold ${colors.text}`}>
              {value.toLocaleString()}
            </p>
            <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
              / {total.toLocaleString()}
            </span>
          </div>

          {subtitle && (
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {subtitle}
            </p>
          )}

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <span>{percentage.toFixed(1)}%</span>
              <span>{value > 0 ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
              <motion.div
                className={`h-2 rounded-full ${colors.text}`}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        <div className={`ml-4 p-3 rounded-lg ${colors.bg}`}>
          <div className={colors.icon}>
            {icon}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default DashboardWidget