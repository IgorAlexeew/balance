// ============ Общие типы данных (DTO) — используются и на клиенте, и на сервере ============

export type TaskStatus = 'todo' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ReminderType =
  | 'at_deadline'
  | 'before'
  | 'daily'
  | 'morning'
  | 'weekly'
  | 'once'
export type TransactionType = 'income' | 'expense'
export type EventColor = 'emerald' | 'amber' | 'rose' | 'violet' | 'teal' | 'orange'
export type MemberRole = 'owner' | 'member'

export const TASK_STATUSES: TaskStatus[] = ['todo', 'done']
export const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
export const REMINDER_TYPES: ReminderType[] = [
  'at_deadline',
  'before',
  'daily',
  'morning',
  'weekly',
  'once',
]
export const EVENT_COLORS: EventColor[] = ['emerald', 'amber', 'rose', 'violet', 'teal', 'orange']

export interface ReminderDTO {
  id: string
  taskId: string
  type: ReminderType
  time: string | null // "HH:MM"
  daysOfWeek: string | null // "1,3,5" (1=Пн ... 7=Вс)
  offsetMinutes: number | null
  fireAt: string | null // ISO
  enabled: boolean
  lastFiredAt: string | null // ISO
}

export interface TaskDTO {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  deadline: string | null // ISO
  completedAt: string | null // ISO
  assigneeId: string | null
  assigneeName: string | null
  createdById: string
  createdByName: string | null
  groupId: string | null
  reminder: ReminderDTO | null
  createdAt: string
  updatedAt: string
}

export interface ReminderInput {
  type: ReminderType
  time?: string | null // "HH:MM" — для daily/morning/weekly
  daysOfWeek?: string | null // "1,3,5" — для weekly
  offsetMinutes?: number | null // для before
  fireAt?: string | null // ISO — для once
}

export interface TaskInput {
  title: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  deadline?: string | null // ISO
  assigneeId?: string | null
  groupId?: string | null // null => личная задача
  reminder?: ReminderInput | null // null/undefined => удалить напоминание
}

export interface TransactionDTO {
  id: string
  type: TransactionType
  amount: number
  category: string
  description: string | null
  date: string // "YYYY-MM-DD"
  userId: string
  userName: string | null
  groupId: string | null
  createdAt: string
}

export interface TransactionInput {
  type: TransactionType
  amount: number
  category: string
  description?: string | null
  date: string // "YYYY-MM-DD"
  groupId?: string | null
}

export interface BudgetSummaryDTO {
  month: string // "YYYY-MM"
  totalIncome: number
  totalExpense: number
  balance: number
  byCategory: {
    category: string
    type: TransactionType
    total: number
    count: number
  }[]
  byDay: {
    day: number // день месяца 1..31
    income: number
    expense: number
  }[]
}

export interface CalendarEventDTO {
  id: string
  title: string
  description: string | null
  start: string // ISO
  end: string // ISO
  allDay: boolean
  color: EventColor
  userId: string
  userName: string | null
  groupId: string | null
  createdAt: string
}

export interface CalendarEventInput {
  title: string
  description?: string | null
  start: string // ISO
  end: string // ISO
  allDay?: boolean
  color?: EventColor
  groupId?: string | null
}

export interface FamilyMemberDTO {
  id: string
  userId: string
  name: string | null
  email: string | null
  role: MemberRole
  createdAt: string
}

export interface FamilyGroupDTO {
  id: string
  name: string
  description: string | null
  inviteCode: string
  ownerId: string
  createdAt: string
  members: FamilyMemberDTO[]
}

export interface UserNotificationDTO {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  taskId: string | null
  createdAt: string
}

// ============ Параметры запросов ============

export type TaskFilterStatus = 'all' | 'todo' | 'done' | 'overdue'
