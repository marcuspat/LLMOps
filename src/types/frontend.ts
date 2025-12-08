/**
 * Frontend-specific type definitions for Turbo Flow UI
 */

import { Agent, Swarm, Task, TruthVerificationResult, GitHubRepo, SecurityScan, PerformanceMetrics, WebSocketMessage } from './index';

// UI Component Props
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
  testId?: string;
}

// Navigation Types
export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  badge?: number;
  children?: NavigationItem[];
  requiredPermissions?: string[];
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
  active?: boolean;
}

// Dashboard Types
export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  position: WidgetPosition;
  config: WidgetConfig;
  data?: any;
}

export type WidgetType =
  | 'swarm-status'
  | 'agent-metrics'
  | 'task-progress'
  | 'performance-chart'
  | 'security-alerts'
  | 'github-status'
  | 'truth-verification'
  | 'collaboration-status'
  | 'system-health'
  | 'custom';

export interface WidgetSize {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface WidgetConfig {
  refreshInterval?: number;
  filters?: Record<string, any>;
  chartType?: string;
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
}

// Form Types
export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  description?: string;
  validation?: ValidationRule[];
  options?: SelectOption[];
  defaultValue?: any;
  disabled?: boolean;
  hidden?: boolean;
}

export type FieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'time'
  | 'datetime'
  | 'file'
  | 'json'
  | 'code';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message: string;
}

export interface FormState {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

// Table Types
export interface TableColumn<T = any> {
  key: string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  minWidth?: string | number;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  fixed?: 'left' | 'right';
}

export interface TableAction<T = any> {
  key: string;
  label: string;
  icon?: string;
  onClick: (record: T, index: number) => void;
  disabled?: (record: T) => boolean;
  hidden?: (record: T) => boolean;
  danger?: boolean;
}

export interface TableState<T = any> {
  data: T[];
  loading: boolean;
  pagination: TablePagination;
  filters: Record<string, any>;
  sorter: TableSorter;
  selectedRows: T[];
  expandedRows: string[];
}

export interface TablePagination {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  pageSizeOptions?: number[];
}

export interface TableSorter {
  field?: string;
  direction?: 'asc' | 'desc';
}

// Modal/Dialog Types
export interface ModalProps {
  open: boolean;
  title: string;
  width?: number | string;
  closable?: boolean;
  maskClosable?: boolean;
  footer?: React.ReactNode;
  onCancel?: () => void;
  onOk?: () => void;
  loading?: boolean;
  destroyOnClose?: boolean;
  centered?: boolean;
}

// Chart Types
export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
  yAxisID?: string;
}

export interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  plugins?: ChartPlugins;
  scales?: ChartScales;
  interaction?: ChartInteraction;
  animation?: ChartAnimation;
}

export interface ChartPlugins {
  legend?: ChartLegend;
  tooltip?: ChartTooltip;
  title?: ChartTitle;
}

export interface ChartLegend {
  display?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export interface ChartTooltip {
  enabled?: boolean;
  mode?: 'index' | 'dataset' | 'point' | 'nearest';
  intersect?: boolean;
}

export interface ChartTitle {
  display?: boolean;
  text?: string;
  font?: ChartFont;
}

export interface ChartFont {
  size?: number;
  weight?: 'normal' | 'bold';
  family?: string;
}

export interface ChartScales {
  x?: ChartScale;
  y?: ChartScale;
  [key: string]: ChartScale;
}

export interface ChartScale {
  type?: 'linear' | 'logarithmic' | 'category' | 'time';
  display?: boolean;
  min?: number;
  max?: number;
  grid?: ChartGrid;
  ticks?: ChartTicks;
}

export interface ChartGrid {
  display?: boolean;
  color?: string;
  lineWidth?: number;
}

export interface ChartTicks {
  display?: boolean;
  callback?: (value: any, index: number, values: any[]) => string;
}

export interface ChartInteraction {
  mode?: string;
  intersect?: boolean;
}

export interface ChartAnimation {
  duration?: number;
  easing?: string;
}

// Notification Types
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  action?: NotificationAction;
  timestamp: Date;
  read: boolean;
}

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

// Layout Types
export interface LayoutConfig {
  sidebar: SidebarConfig;
  header: HeaderConfig;
  content: ContentConfig;
  footer?: FooterConfig;
}

export interface SidebarConfig {
  collapsible: boolean;
  collapsed: boolean;
  width: number;
  collapsedWidth: number;
  theme: 'light' | 'dark';
}

export interface HeaderConfig {
  height: number;
  fixed: boolean;
  showBreadcrumb: boolean;
  showUserInfo: boolean;
  showNotifications: boolean;
  showSearch: boolean;
}

export interface ContentConfig {
  padding: number;
  maxWidth?: number;
  background: string;
}

export interface FooterConfig {
  height: number;
  fixed: boolean;
  content?: React.ReactNode;
}

// Theme Types
export interface Theme {
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  breakpoints: ThemeBreakpoints;
  shadows: ThemeShadows;
  borders: ThemeBorders;
}

export interface ThemeColors {
  primary: ColorPalette;
  secondary: ColorPalette;
  success: ColorPalette;
  warning: ColorPalette;
  error: ColorPalette;
  info: ColorPalette;
  neutral: ColorPalette;
  background: BackgroundColors;
  text: TextColors;
}

export interface ColorPalette {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

export interface BackgroundColors {
  primary: string;
  secondary: string;
  tertiary: string;
  overlay: string;
}

export interface TextColors {
  primary: string;
  secondary: string;
  tertiary: string;
  inverse: string;
}

export interface ThemeTypography {
  fontFamily: FontFamily;
  fontSize: FontSize;
  fontWeight: FontWeight;
  lineHeight: LineHeight;
}

export interface FontFamily {
  sans: string[];
  serif: string[];
  mono: string[];
}

export interface FontSize {
  xs: string;
  sm: string;
  base: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
  '5xl': string;
}

export interface FontWeight {
  light: number;
  normal: number;
  medium: number;
  semibold: number;
  bold: number;
}

export interface LineHeight {
  tight: number;
  normal: number;
  relaxed: number;
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
}

export interface ThemeBreakpoints {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface ThemeBorders {
  width: BorderWidth;
  radius: BorderRadius;
}

export interface BorderWidth {
  none: string;
  sm: string;
  md: string;
  lg: string;
}

export interface BorderRadius {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

// State Management Types
export interface AppState {
  auth: AuthState;
  swarms: SwarmsState;
  agents: AgentsState;
  tasks: TasksState;
  github: GitHubState;
  security: SecurityState;
  performance: PerformanceState;
  ui: UIState;
  notifications: NotificationsState;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  permissions: string[];
}

export interface SwarmsState {
  swarms: Swarm[];
  activeSwarmId: string | null;
  loading: boolean;
  error: string | null;
}

export interface AgentsState {
  agents: Agent[];
  selectedAgentId: string | null;
  loading: boolean;
  error: string | null;
  filters: AgentFilters;
}

export interface AgentFilters {
  status?: string[];
  type?: string[];
  swarmId?: string;
  search?: string;
}

export interface TasksState {
  tasks: Task[];
  selectedTaskId: string | null;
  loading: boolean;
  error: string | null;
  filters: TaskFilters;
  view: 'list' | 'kanban' | 'timeline';
}

export interface TaskFilters {
  status?: string[];
  priority?: string[];
  type?: string[];
  assignedAgentId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
}

export interface GitHubState {
  repositories: GitHubRepo[];
  activeRepoId: string | null;
  pullRequests: GitHubPullRequest[];
  issues: GitHubIssue[];
  loading: boolean;
  error: string | null;
  webhooks: GitHubWebhook[];
}

export interface GitHubPullRequest {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  author: string;
  baseBranch: string;
  headBranch: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
  reviews: GitHubReview[];
  checks: GitHubCheck[];
}

export interface GitHubReview {
  id: string;
  user: string;
  state: 'approved' | 'changes_requested' | 'commented' | 'pending';
  body: string;
  submittedAt: Date;
}

export interface GitHubCheck {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | null;
  startedAt?: Date;
  completedAt?: Date;
}

export interface GitHubIssue {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  author: string;
  assignees: string[];
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GitHubWebhook {
  id: string;
  events: string[];
  active: boolean;
  url: string;
  secret?: string;
}

export interface SecurityState {
  scans: SecurityScan[];
  alerts: SecurityAlert[];
  loading: boolean;
  error: string | null;
  filters: SecurityFilters;
}

export interface SecurityAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  source: string;
  timestamp: Date;
  status: 'open' | 'investigating' | 'resolved';
}

export interface SecurityFilters {
  severity?: string[];
  type?: string[];
  status?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface PerformanceState {
  metrics: PerformanceMetrics[];
  loading: boolean;
  error: string | null;
  timeRange: TimeRange;
  selectedMetrics: string[];
}

export interface TimeRange {
  start: Date;
  end: Date;
  preset?: '1h' | '6h' | '24h' | '7d' | '30d';
}

export interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  layout: LayoutConfig;
  dashboard: DashboardState;
  modals: ModalState;
}

export interface DashboardState {
  widgets: DashboardWidget[];
  layout: 'grid' | 'masonry';
  columns: number;
  editing: boolean;
}

export interface ModalState {
  [key: string]: boolean;
}

export interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  settings: NotificationSettings;
}

export interface NotificationSettings {
  desktop: boolean;
  email: boolean;
  security: boolean;
  tasks: boolean;
  performance: boolean;
  github: boolean;
}

// API Hook Types
export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  mutate: (data: Partial<T>) => void;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterParams {
  [key: string]: any;
}

export interface QueryParams extends PaginationParams {
  sort?: SortParams;
  filter?: FilterParams;
  search?: string;
}

// Collaboration Types
export interface CollaborationSession {
  id: string;
  name: string;
  participants: Participant[];
  status: 'active' | 'paused' | 'ended';
  type: 'pair-programming' | 'code-review' | 'planning' | 'debugging';
  createdAt: Date;
  settings: CollaborationSettings;
}

export interface Participant {
  userId: string;
  username: string;
  role: 'driver' | 'navigator' | 'observer';
  joinedAt: Date;
  cursor?: CursorPosition;
  selection?: SelectionRange;
}

export interface CursorPosition {
  file: string;
  line: number;
  column: number;
}

export interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

export interface CollaborationSettings {
  allowAnonymous: boolean;
  requireApproval: boolean;
  maxParticipants: number;
  recordingEnabled: boolean;
  voiceChat: boolean;
  screenShare: boolean;
}

// File Upload Types
export interface FileUpload {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  url?: string;
  error?: string;
}

export interface UploadOptions {
  accept?: string[];
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  autoUpload?: boolean;
}

// Accessibility Types
export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  focusVisible: boolean;
}

// Keyboard Shortcuts
export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: string;
  description: string;
  global?: boolean;
}

// Error Boundary Types
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// Context Types
export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface WebSocketContextType {
  socket: WebSocket | null;
  connected: boolean;
  subscribe: (channel: string, callback: (message: WebSocketMessage) => void) => void;
  unsubscribe: (channel: string) => void;
  send: (message: WebSocketMessage) => void;
}

export interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
}

// Drag and Drop Types
export interface DragItem {
  type: string;
  id: string;
  data: any;
}

export interface DropZoneProps {
  accepts: string[];
  onDrop: (item: DragItem) => void;
  disabled?: boolean;
  className?: string;
}

// Virtual Scrolling Types
export interface VirtualScrollItem {
  index: number;
  size: number;
  data: any;
}

export interface VirtualScrollProps {
  items: any[];
  itemHeight?: number;
  itemSize?: (index: number) => number;
  containerHeight: number;
  renderItem: (item: VirtualScrollItem) => React.ReactNode;
  overscan?: number;
}

// Lazy Loading Types
export interface LazyLoadProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  threshold?: number;
  delay?: number;
}

// Infinite Scroll Types
export interface InfiniteScrollProps {
  children: React.ReactNode;
  hasMore: boolean;
  loadMore: () => void;
  loading?: boolean;
  threshold?: number;
  rootMargin?: string;
}

// Route Protection Types
export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  redirectTo?: string;
  fallback?: React.ReactNode;
}

// Feature Flag Types
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  conditions?: FeatureFlagCondition[];
}

export interface FeatureFlagCondition {
  type: 'user' | 'environment' | 'custom';
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains';
  value: any;
}

// Testing Types
export interface TestComponentProps {
  children?: React.ReactNode;
  testId?: string;
  'data-testid'?: string;
}

export interface MockData {
  agents: Agent[];
  swarms: Swarm[];
  tasks: Task[];
  githubRepos: GitHubRepo[];
  securityScans: SecurityScan[];
  performanceMetrics: PerformanceMetrics[];
}

// Development Tools Types
export interface DevToolsState {
  enabled: boolean;
  panel: 'console' | 'network' | 'components' | 'profiler' | null;
  logs: DevLog[];
}

export interface DevLog {
  timestamp: Date;
  level: 'log' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type EventHandler<T = Event> = (event: T) => void;

export type AsyncEventHandler<T = Event> = (event: T) => Promise<void>;

// Export all types for external use
export type {
  Agent,
  Swarm,
  Task,
  TruthVerificationResult,
  GitHubRepo,
  SecurityScan,
  PerformanceMetrics,
  WebSocketMessage,
  User
};