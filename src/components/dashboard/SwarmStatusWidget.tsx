/**
 * Swarm Status Widget
 */

import React from 'react'
import { Swarm, SwarmStatus } from '../../types/frontend'
import { Activity, Clock, AlertCircle, CheckCircle } from 'lucide-react'

interface SwarmStatusWidgetProps {
  swarms: Swarm[]
  loading?: boolean
}

const statusConfig = {
  active: {
    icon: CheckCircle,
    color: 'text-success-500',
    bgColor: 'bg-success-100 dark:bg-success-900',
    label: 'Active',
  },
  idle: {
    icon: Clock,
    color: 'text-warning-500',
    bgColor: 'bg-warning-100 dark:bg-warning-900',
    label: 'Idle',
  },
  error: {
    icon: AlertCircle,
    color: 'text-error-500',
    bgColor: 'bg-error-100 dark:bg-error-900',
    label: 'Error',
  },
  initializing: {
    icon: Activity,
    color: 'text-info-500',
    bgColor: 'bg-info-100 dark:bg-info-900',
    label: 'Initializing',
  },
}

export const SwarmStatusWidget: React.FC<SwarmStatusWidgetProps> = ({
  swarms,
  loading = false,
}) => {
  const statusCounts = React.useMemo(() => {
    const counts = {
      active: 0,
      idle: 0,
      error: 0,
      initializing: 0,
    }

    swarms.forEach(swarm => {
      counts[swarm.status]++
    })

    return counts
  }, [swarms])

  const total = swarms.length

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Swarm Status
        </h3>
        <div className="text-sm text-neutral-500 dark:text-neutral-400">
          {total} {total === 1 ? 'Swarm' : 'Swarms'}
        </div>
      </div>

      <div className="space-y-3">
        {(Object.entries(statusCounts) as [SwarmStatus, number][]).map(([status, count]) => {
          if (count === 0) return null

          const config = statusConfig[status]
          const Icon = config.icon
          const percentage = total > 0 ? (count / total) * 100 : 0

          return (
            <div
              key={status}
              className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800"
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${config.bgColor}`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div>
                  <div className="text-sm font-medium text-neutral-900 dark:text-white">
                    {config.label}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {count} {count === 1 ? 'swarm' : 'swarms'}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="text-sm font-medium text-neutral-900 dark:text-white">
                  {percentage.toFixed(0)}%
                </div>
                <div className="w-16 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${config.color.replace('text-', 'bg-')}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {total === 0 && (
        <div className="text-center py-8">
          <div className="text-neutral-400 dark:text-neutral-600 mb-2">
            <Activity className="w-8 h-8 mx-auto" />
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No swarms configured
          </p>
        </div>
      )}
    </div>
  )
}

export default SwarmStatusWidget