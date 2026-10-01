import type {
  Prisma,
  Task as TaskModel,
  Reminder as ReminderModel,
  Transaction as TransactionModel,
  CalendarEvent as CalendarEventModel,
  FamilyGroup as FamilyGroupModel,
  UserNotification as UserNotificationModel,
} from '@prisma/client'
import type {
  CalendarEventDTO,
  EventColor,
  FamilyGroupDTO,
  MemberRole,
  ReminderDTO,
  ReminderType,
  TaskDTO,
  TaskPriority,
  TaskStatus,
  TransactionDTO,
  TransactionType,
  UserNotificationDTO,
} from '@/lib/types'
import { EVENT_COLORS, REMINDER_TYPES, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/types'

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: { reminder: true; assignee: true; createdBy: true }
}>

export type TransactionWithUser = Prisma.TransactionGetPayload<{ include: { user: true } }>

export type EventWithUser = Prisma.CalendarEventGetPayload<{ include: { user: true } }>

export type GroupWithMembers = Prisma.FamilyGroupGetPayload<{
  include: { members: { include: { user: true } } }
}>

function asTaskStatus(v: string): TaskStatus {
  return (TASK_STATUSES as string[]).includes(v) ? (v as TaskStatus) : 'todo'
}

function asTaskPriority(v: string): TaskPriority {
  return (TASK_PRIORITIES as string[]).includes(v) ? (v as TaskPriority) : 'medium'
}

function asReminderType(v: string): ReminderType {
  return (REMINDER_TYPES as string[]).includes(v) ? (v as ReminderType) : 'daily'
}

function asTransactionType(v: string): TransactionType {
  return v === 'income' ? 'income' : 'expense'
}

function asEventColor(v: string): EventColor {
  return (EVENT_COLORS as string[]).includes(v) ? (v as EventColor) : 'emerald'
}

function asMemberRole(v: string): MemberRole {
  return v === 'owner' ? 'owner' : 'member'
}

function reminderToDTO(r: ReminderModel): ReminderDTO {
  return {
    id: r.id,
    taskId: r.taskId,
    type: asReminderType(r.type),
    time: r.time,
    daysOfWeek: r.daysOfWeek,
    offsetMinutes: r.offsetMinutes,
    fireAt: r.fireAt ? r.fireAt.toISOString() : null,
    enabled: r.enabled,
    lastFiredAt: r.lastFiredAt ? r.lastFiredAt.toISOString() : null,
  }
}

export function taskToDTO(t: TaskWithRelations): TaskDTO {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: asTaskStatus(t.status),
    priority: asTaskPriority(t.priority),
    deadline: t.deadline ? t.deadline.toISOString() : null,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee?.name ?? null,
    createdById: t.createdById,
    createdByName: t.createdBy?.name ?? null,
    groupId: t.groupId,
    reminder: t.reminder ? reminderToDTO(t.reminder) : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

export function transactionToDTO(t: TransactionWithUser): TransactionDTO {
  return {
    id: t.id,
    type: asTransactionType(t.type),
    amount: t.amount,
    category: t.category,
    description: t.description,
    date: t.date.toISOString().slice(0, 10),
    userId: t.userId,
    userName: t.user?.name ?? null,
    groupId: t.groupId,
    createdAt: t.createdAt.toISOString(),
  }
}

export function eventToDTO(e: EventWithUser): CalendarEventDTO {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    allDay: e.allDay,
    color: asEventColor(e.color),
    userId: e.userId,
    userName: e.user?.name ?? null,
    groupId: e.groupId,
    createdAt: e.createdAt.toISOString(),
  }
}

export function groupWithMembersToDTO(g: GroupWithMembers): FamilyGroupDTO {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    inviteCode: g.inviteCode,
    ownerId: g.ownerId,
    createdAt: g.createdAt.toISOString(),
    members: g.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user?.name ?? null,
      email: m.user?.email ?? null,
      role: asMemberRole(m.role),
      createdAt: m.createdAt.toISOString(),
    })),
  }
}

export function notificationToDTO(n: UserNotificationModel): UserNotificationDTO {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    read: n.read,
    taskId: n.taskId,
    createdAt: n.createdAt.toISOString(),
  }
}

export type { TaskModel, ReminderModel, TransactionModel, CalendarEventModel, FamilyGroupModel }
