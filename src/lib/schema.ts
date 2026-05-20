import { pgTable, serial, text, integer, real, timestamp, boolean, jsonb, date, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const goals = pgTable('goals', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  why: text('why'),
  // 'binary' | 'quantitative' | 'milestone' | 'todo'
  type: text('type').notNull(),
  // 'daily' | 'weekly' | 'monthly' — ignored for one-time 'todo' goals
  cadence: text('cadence').notNull().default('daily'),
  // For quantitative goals: target value per cadence period (e.g. 20 miles per week)
  targetValue: real('target_value'),
  targetUnit: text('target_unit'),
  // Reminder schedule — minutes after midnight in local tz, plus days bitmask (Sun=1, Mon=2, ...)
  remindAtMinutes: integer('remind_at_minutes'),
  remindDaysMask: integer('remind_days_mask'),
  // For 'todo' goals: optional due date and one-time completion timestamp.
  dueDate: date('due_date'),
  completedAt: timestamp('completed_at'),
  // Pause window — skip reminders & don't break streaks while paused
  pausedUntil: date('paused_until'),
  archivedAt: timestamp('archived_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const entries = pgTable(
  'entries',
  {
    id: serial('id').primaryKey(),
    goalId: integer('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
    // Local-date the entry applies to (not the creation timestamp).
    entryDate: date('entry_date').notNull(),
    // For binary: 1 = done, 0 = explicit miss. For quantitative: the value.
    value: real('value').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('entries_goal_date_unique').on(t.goalId, t.entryDate),
    index('entries_date_idx').on(t.entryDate),
  ]
);

// Milestone sub-tasks for 'milestone' goals
export const milestones = pgTable('milestones', {
  id: serial('id').primaryKey(),
  goalId: integer('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  completedAt: timestamp('completed_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Log of sent reminders — used for escalating nudges & dedupe
export const reminderLog = pgTable(
  'reminder_log',
  {
    id: serial('id').primaryKey(),
    goalId: integer('goal_id').references(() => goals.id, { onDelete: 'cascade' }),
    // 'reminder' | 'nudge' | 'digest' | 'test'
    kind: text('kind').notNull(),
    sentAt: timestamp('sent_at').notNull().defaultNow(),
    payload: jsonb('payload'),
  },
  (t) => [index('reminder_log_goal_sent_idx').on(t.goalId, t.sentAt)]
);

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Milestone = typeof milestones.$inferSelect;
export type PushSub = typeof pushSubscriptions.$inferSelect;
