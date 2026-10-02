export const TASK_STATUSES = ['todo', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const TASK_FILTERS = ['all', 'todo', 'done', 'overdue'] as const
export type TaskFilter = (typeof TASK_FILTERS)[number]

export const REMINDER_TYPES = ['at_deadline', 'before', 'daily', 'morning', 'weekly', 'once'] as const
export type ReminderType = (typeof REMINDER_TYPES)[number]

export const TRANSACTION_TYPES = ['income', 'expense'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const EVENT_COLORS = ['emerald', 'amber', 'rose', 'violet', 'teal', 'orange'] as const
export type EventColor = (typeof EVENT_COLORS)[number]

export const MEMBER_ROLES = ['owner', 'member'] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

export const NOTIFICATION_TYPES = ['reminder', 'info'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]
