/**
 * Main App Component
 */

import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'

import { useAuth } from './contexts/AuthContext'
import { useWebSocket } from './contexts/WebSocketContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoadingScreen } from './components/LoadingScreen'
import { ErrorScreen } from './components/ErrorScreen'

// Page imports
import { LoginPage } from './pages/auth/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { SwarmsPage } from './pages/swarms/SwarmsPage'
import { SwarmDetailPage } from './pages/swarms/SwarmDetailPage'
import { AgentsPage } from './pages/agents/AgentsPage'
import { AgentDetailPage } from './pages/agents/AgentDetailPage'
import { TasksPage } from './pages/tasks/TasksPage'
import { TaskDetailPage } from './pages/tasks/TaskDetailPage'
import { GitHubPage } from './pages/github/GitHubPage'
import { SecurityPage } from './pages/security/SecurityPage'
import { PerformancePage } from './pages/performance/PerformancePage'
import { CollaborationPage } from './pages/collaboration/CollaborationPage'
import { ConfigurationPage } from './pages/configuration/ConfigurationPage'
import { DocumentationPage } from './pages/documentation/DocumentationPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { ProfilePage } from './pages/profile/ProfilePage'
import { NotFoundPage } from './pages/NotFoundPage'

// Animation variants
const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  in: {
    opacity: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    y: -20,
  },
}

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.3,
}

const App: React.FC = () => {
  const { isAuthenticated, loading, user } = useAuth()
  const { connected } = useWebSocket()

  // Show loading screen while checking authentication
  if (loading) {
    return <LoadingScreen message="Initializing application..." />
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Connection status indicator */}
      {!connected && (
        <div className="fixed top-0 right-0 z-50 p-4">
          <div className="bg-warning-100 dark:bg-warning-900 border border-warning-200 dark:border-warning-700 rounded-lg px-3 py-2 flex items-center space-x-2">
            <div className="w-2 h-2 bg-warning-500 rounded-full animate-pulse" />
            <span className="text-sm text-warning-800 dark:text-warning-200">
              Reconnecting...
            </span>
          </div>
        </div>
      )}

      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <motion.div
                initial="initial"
                animate="in"
                exit="out"
                variants={pageVariants}
                transition={pageTransition}
              >
                <LoginPage />
              </motion.div>
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />

        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route
                    path="/dashboard"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <DashboardPage />
                      </motion.div>
                    }
                  />

                  {/* Swarm routes */}
                  <Route
                    path="/swarms"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <SwarmsPage />
                      </motion.div>
                    }
                  />
                  <Route
                    path="/swarms/:id"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <SwarmDetailPage />
                      </motion.div>
                    }
                  />

                  {/* Agent routes */}
                  <Route
                    path="/agents"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <AgentsPage />
                      </motion.div>
                    }
                  />
                  <Route
                    path="/agents/:id"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <AgentDetailPage />
                      </motion.div>
                    }
                  />

                  {/* Task routes */}
                  <Route
                    path="/tasks"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <TasksPage />
                      </motion.div>
                    }
                  />
                  <Route
                    path="/tasks/:id"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <TaskDetailPage />
                      </motion.div>
                    }
                  />

                  {/* GitHub routes */}
                  <Route
                    path="/github"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <GitHubPage />
                      </motion.div>
                    }
                  />

                  {/* Security routes */}
                  <Route
                    path="/security"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <SecurityPage />
                      </motion.div>
                    }
                  />

                  {/* Performance routes */}
                  <Route
                    path="/performance"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <PerformancePage />
                      </motion.div>
                    }
                  />

                  {/* Collaboration routes */}
                  <Route
                    path="/collaboration"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <CollaborationPage />
                      </motion.div>
                    }
                  />

                  {/* Configuration routes */}
                  <Route
                    path="/configuration"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <ConfigurationPage />
                      </motion.div>
                    }
                  />

                  {/* Documentation routes */}
                  <Route
                    path="/docs"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <DocumentationPage />
                      </motion.div>
                    }
                  />

                  {/* Settings routes */}
                  <Route
                    path="/settings"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <SettingsPage />
                      </motion.div>
                    }
                  />

                  {/* Profile routes */}
                  <Route
                    path="/profile"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <ProfilePage />
                      </motion.div>
                    }
                  />

                  {/* Default route */}
                  <Route
                    path="/"
                    element={<Navigate to="/dashboard" replace />}
                  />

                  {/* 404 route */}
                  <Route
                    path="*"
                    element={
                      <motion.div
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                      >
                        <NotFoundPage />
                      </motion.div>
                    }
                  />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Fallback route */}
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      </Routes>

      {/* Development tools */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-4 right-4 z-50 text-xs text-neutral-500 dark:text-neutral-400">
          <div>Auth: {isAuthenticated ? '✅' : '❌'}</div>
          <div>WebSocket: {connected ? '✅' : '❌'}</div>
          <div>User: {user?.username || 'None'}</div>
        </div>
      )}
    </div>
  )
}

export default App