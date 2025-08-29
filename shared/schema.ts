import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => userSessions.sessionId),
  content: text("content").notNull(),
  originalContent: text("original_content").notNull(), // Content before variable substitution
  tags: json("tags").$type<string[]>().default([]),
  folder: text("folder").default("General"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const variables = pgTable("variables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => userSessions.sessionId),
  name: text("name").notNull(),
  values: json("values").$type<string[]>().notNull().default([]), // Array of values for each variable
}, (table) => ({
  // Unique constraint to prevent duplicate variable names per session
  uniqueSessionVariable: unique().on(table.sessionId, table.name)
}));

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
  lastActiveAt: true,
});

export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
});

export const insertVariableSchema = createInsertSchema(variables).omit({
  id: true,
});

export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;
export type InsertVariable = z.infer<typeof insertVariableSchema>;
export type Variable = typeof variables.$inferSelect;
