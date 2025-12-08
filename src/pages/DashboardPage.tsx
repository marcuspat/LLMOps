/**
 * Dashboard Page - Main overview of the Turbo Flow system
 */

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Users,
  CheckCircle,
  AlertTriangle,
  GitBranch,
  Shield,
  TrendingUp,
  Clock,
  Cpu,
  HardDrive,
  Network,
  Zap,
  BarChart3,
  Settings,
  RefreshCw,
  Plus,
  Eye,
} from 'lucide-react'

import { useQuery } from '@tanstack/react-query'

import { swarmsService } from '../services/swarms'
import { agentsService } from '../services/agents'
import { tasksService } from '../services/tasks'
import { securityService } from '../services/security'
import { githubService } from '../services/github'
import { performanceService } from '../services/performance'

import { DashboardWidget } from '../components/dashboard/DashboardWidget'
import { SwarmStatusWidget } from '../components/dashboard/SwarmStatusWidget'
import { AgentMetricsWidget } from '../components/dashboard/AgentMetricsWidget'
import { TaskProgressWidget } from '../components/dashboard/TaskProgressWidget'
import { SecurityAlertsWidget } from '../components/dashboard/SecurityAlertsWidget'
import { PerformanceChart } from '../components/dashboard/PerformanceChart'
import { GitHubStatusWidget } from '../components/dashboard/GitHubStatusWidget'
import { TruthVerificationWidget } from '../components/dashboard/TruthVerificationWidget'
import { SystemHealthWidget } from '../components/dashboard/SystemHealthWidget'
import { QuickActions } from '../components/dashboard/QuickActions'
import { RecentActivity } from '../components/dashboard/RecentActivity'

interface DashboardStats {
  swarms: {
    total: number
    active: number
    idle: number
    error: number
  }
  agents: {
    total: number
    active: number
    idle: number
    busy: number
    error: number
  }
  tasks: {
    total: number
    completed: number
    inProgress: number
    pending: number
    failed: number
  }
  security: {
    totalAlerts: number
    critical: number
    high: number
    medium: number
    low: number
  }
  github: {
    totalRepos: number
    openPRs: number
    openIssues: number
    activeWorkflows: number
  }
  performance: {
    cpuUsage: number
    memoryUsage: number
    networkThroughput: number
    responseTime: number
  }
  truth: {
    verificationScore: number
    totalVerifications: number
    passed: number
    failed: number
    pending: number
  }
}

const DashboardPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h')
  const [refreshInterval, setRefreshInterval] = useState<number>(30000) // 30 seconds
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch dashboard data
  const { data: swarmsData, isLoading: swarmsLoading } = useQuery({
    queryKey: ['dashboard-swarms', timeRange],
    queryFn: () => swarmsService.getSwarms(),
    refetchInterval: autoRefresh ? refreshInterval : false,
  })

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['dashboard-agents', timeRange],
    queryFn: () => agentsService.getAgents(),
    refetchInterval: autoRefresh ? refreshInterval : false,
  })

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['dashboard-tasks', timeRange],
    queryFn: () => tasksService.getTasks({
      filter: { status: ['in_progress', 'completed'] },
      limit: 50,
    }),
    refetchInterval: autoRefresh ? refreshInterval : false,
  })

  const { data: securityData, isLoading: securityLoading } = useQuery({
    queryKey: ['dashboard-security', timeRange],
    queryFn: () => securityService.getDashboardData({
      timeRange: getTimeRangeBounds(timeRange),
    }),
    refetchInterval: autoRefresh ? refreshInterval : false,
  })

  const { data: githubData, isLoading: githubLoading } = useQuery({
    queryKey: ['dashboard-github', timeRange],
    queryFn: () => githubService.getStats(),
    refetchInterval: autoRefresh ? refreshInterval : false,
  })

  const { data: performanceData, isLoading: performanceLoading } = useQuery({
    queryKey: ['dashboard-performance', timeRange],
    queryFn: () => performanceService.getMetrics({
      timeRange: getTimeRangeBounds(timeRange),
      granularity: 'hour',
    }),
    refetchInterval: autoRefresh ? refreshInterval : false,
  })

  // Calculate aggregated stats
  const stats: DashboardStats = React.useMemo(() => {
    const swarms = swarmsData?.data || []
    const agents = agentsData?.data || []
    const tasks = tasksData?.data || []
    const securitySummary = securityData?.data?.summary
    const githubStats = githubData?.data
    const performanceMetrics = performanceData?.data?.[performanceData?.data?.length - 1]

    return {
      swarms: {
        total: swarms.length,
        active: swarms.filter(s => s.status === 'active').length,
        idle: swarms.filter(s => s.status === 'idle').length,
        error: swarms.filter(s => s.status === 'error').length,
      },
      agents: {
        total: agents.length,
        active: agents.filter(a => a.status === 'active').length,
        idle: agents.filter(a => a.status === 'idle').length,
        busy: agents.filter(a => a.status === 'busy').length,
        error: agents.filter(a => a.status === 'error').length,
      },
      tasks: {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        pending: tasks.filter(t => t.status === 'pending').length,
        failed: tasks.filter(t => t.status === 'failed').length,
      },
      security: securitySummary ? {
        totalAlerts: securitySummary.totalFindings,
        critical: securitySummary.criticalFindings,
        high: securitySummary.highFindings,
        medium: securitySummary.mediumFindings,
        low: securitySummary.lowFindings,
      } : {
        totalAlerts: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      github: githubStats || {
        totalRepos: 0,
        openPRs: 0,
        openIssues: 0,
        activeWorkflows: 0,
      },
      performance: performanceMetrics ? {
        cpuUsage: performanceMetrics.cpu?.usage || 0,
        memoryUsage: performanceMetrics.memory?.percentage || 0,
        networkThroughput: performanceMetrics.network?.bytesIn || 0,
        responseTime: performanceMetrics.requests?.averageResponseTime || 0,
      } : {
        cpuUsage: 0,
        memoryUsage: 0,
        networkThroughput: 0,
        responseTime: 0,
      },
      truth: {
        verificationScore: 0.95, // Placeholder
        totalVerifications: 0,
        passed: 0,
        failed: 0,
        pending: 0,
      },
    }
  }, [swarmsData, agentsData, tasksData, securityData, githubData, performanceData])

  // Get time range bounds
  function getTimeRangeBounds(range: string): { start: Date; end: Date } {
    const end = new Date()
    const start = new Date()

    switch (range) {
      case '1h':
        start.setHours(start.getHours() - 1)
        break
      case '6h':
        start.setHours(start.getHours() - 6)
        break
      case '24h':
        start.setDate(start.getDate() - 1)
        break
      case '7d':
        start.setDate(start.getDate() - 7)
        break
      default:
        start.setDate(start.getDate() - 1)
    }

    return { start, end }
  }

  // Manual refresh
  const handleRefresh = () => {
    // Invalidate all dashboard queries to trigger a refresh
    const queries = [
      ['dashboard-swarms', timeRange],
      ['dashboard-agents', timeRange],
      ['dashboard-tasks', timeRange],
      ['dashboard-security', timeRange],
      ['dashboard-github', timeRange],
      ['dashboard-performance', timeRange],
    ]

    queries.forEach(queryKey => {
      // This would be implemented with your query client
      console.log('Refreshing query:', queryKey)
    })
  }

  const isAnyLoading = swarmsLoading || agentsLoading || tasksLoading || securityLoading || githubLoading || performanceLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Real-time overview of your Turbo Flow system
          </p>
        </div>

        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="input text-sm"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`btn ${autoRefresh ? 'btn-primary' : 'btn-ghost'}`}
          >
            <Clock className="w-4 h-4 mr-2" />
            Auto Refresh
          </button>

          {/* Manual Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isAnyLoading}
            className="btn btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isAnyLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <DashboardWidget
            title="Swarms"
            value={stats.swarms.active}
            total={stats.swarms.total}
            icon={<Users className="w-5 h-5" />}
            color="primary"
            trend={stats.swarms.error > 0 ? 'down' : 'up'}
            loading={swarmsLoading}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <DashboardWidget
            title="Agents"
            value={stats.agents.active}
            total={stats.agents.total}
            icon={<Cpu className="w-5 h-5" />}
            color="success"
            trend={stats.agents.error > 0 ? 'down' : 'up'}
            loading={agentsLoading}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <DashboardWidget
            title="Tasks"
            value={stats.tasks.completed}
            total={stats.tasks.total}
            icon={<CheckCircle className="w-5 h-5" />}
            color="info"
            trend={stats.tasks.failed > 0 ? 'down' : 'up'}
            loading={tasksLoading}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <DashboardWidget
            title="Security Alerts"
            value={stats.security.critical + stats.security.high}
            total={stats.security.totalAlerts}
            icon={<Shield className="w-5 h-5" />}
            color="warning"
            trend={stats.security.critical > 0 ? 'down' : 'up'}
            loading={securityLoading}
          />
        </motion.div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance Charts */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <PerformanceChart
              data={performanceData?.data || []}
              timeRange={timeRange}
              loading={performanceLoading}
            />
          </motion.div>

          {/* Swarm Status & Agent Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <SwarmStatusWidget
                swarms={swarmsData?.data || []}
                loading={swarmsLoading}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <AgentMetricsWidget
                agents={agentsData?.data || []}
                loading={agentsLoading}
              />
            </motion.div>
          </div>

          {/* Task Progress */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
          >
            <TaskProgressWidget
              tasks={tasksData?.data || []}
              loading={tasksLoading}
            />
          </motion.div>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Truth Verification */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9 }}
          >
            <TruthVerificationWidget
              score={stats.truth.verificationScore}
              total={stats.truth.totalVerifications}
              passed={stats.truth.passed}
              failed={stats.truth.failed}
              pending={stats.truth.pending}
            />
          </motion.div>

          {/* GitHub Status */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.0 }}
          >
            <GitHubStatusWidget
              stats={stats.github}
              loading={githubLoading}
            />
          </motion.div>

          {/* Security Alerts */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.1 }}
          >
            <SecurityAlertsWidget
              alerts={securityData?.data?.recentAlerts || []}
              summary={stats.security}
              loading={securityLoading}
            />
          </motion.div>

          {/* System Health */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.2 }}
          >
            <SystemHealthWidget
              performance={stats.performance}
              loading={performanceLoading}
            />
          </motion.div>
        </div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3 }}
      >
        <RecentActivity
          activities={[]} // Would come from a recent activities API
          loading={false}
        />
      </motion.div>
    </div>
  )
}

export default DashboardPage