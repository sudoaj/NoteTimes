import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import { type Note, type InsertNote, type Variable, type InsertVariable, type UserSession, type InsertUserSession } from "@shared/schema";
import { type IStorage } from "./storage";

export class DbStorage implements IStorage {
  async createSession(insertSession: InsertUserSession): Promise<UserSession> {
    const [session] = await db.insert(schema.userSessions)
      .values(insertSession)
      .returning();
    
    // Add some default variables for this session
    await this.createVariable({ sessionId: insertSession.sessionId, name: "user", values: ["John Doe", "Jane Smith", "Bob Wilson"] });
    await this.createVariable({ sessionId: insertSession.sessionId, name: "company", values: ["Acme Inc", "Tech Corp", "Innovation Labs"] });
    await this.createVariable({ sessionId: insertSession.sessionId, name: "project", values: ["Alpha", "Beta", "Gamma"] });
    
    return session;
  }

  async getSession(sessionId: string): Promise<UserSession | null> {
    const result = await db.select()
      .from(schema.userSessions)
      .where(eq(schema.userSessions.sessionId, sessionId))
      .limit(1);
    
    return result[0] || null;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await db.update(schema.userSessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(schema.userSessions.sessionId, sessionId));
  }

  async getNotes(sessionId: string): Promise<Note[]> {
    return await db.select()
      .from(schema.notes)
      .where(eq(schema.notes.sessionId, sessionId))
      .orderBy(desc(schema.notes.createdAt));
  }

  async getNotesByFolder(sessionId: string, folder: string): Promise<Note[]> {
    return await db.select()
      .from(schema.notes)
      .where(and(
        eq(schema.notes.sessionId, sessionId),
        eq(schema.notes.folder, folder)
      ))
      .orderBy(desc(schema.notes.createdAt));
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const [note] = await db.insert(schema.notes)
      .values({
        ...insertNote,
        tags: insertNote.tags ? [...insertNote.tags] : []
      })
      .returning();
    return note;
  }

  async deleteNote(sessionId: string, noteId: string): Promise<void> {
    const result = await db.delete(schema.notes)
      .where(and(
        eq(schema.notes.id, noteId),
        eq(schema.notes.sessionId, sessionId)
      ))
      .returning();
    
    if (result.length === 0) {
      throw new Error("Note not found or does not belong to this session");
    }
  }

  async deleteAllNotes(sessionId: string): Promise<void> {
    await db.delete(schema.notes)
      .where(eq(schema.notes.sessionId, sessionId));
  }

  async getFolders(sessionId: string): Promise<string[]> {
    const result = await db.select({ folder: schema.notes.folder })
      .from(schema.notes)
      .where(eq(schema.notes.sessionId, sessionId))
      .groupBy(schema.notes.folder);
    
    const folders = result.map(r => r.folder || "General");
    if (!folders.includes("General")) {
      folders.unshift("General");
    }
    
    return folders.sort();
  }

  async createFolder(sessionId: string, name: string): Promise<string> {
    // Folders are implicitly created when notes are assigned to them
    // This is just a validation that the session exists
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    return name.trim();
  }

  async getVariables(sessionId: string): Promise<Variable[]> {
    return await db.select()
      .from(schema.variables)
      .where(eq(schema.variables.sessionId, sessionId));
  }

  async createVariable(insertVariable: InsertVariable): Promise<Variable> {
    // Check if variable already exists
    const existing = await db.select()
      .from(schema.variables)
      .where(and(
        eq(schema.variables.sessionId, insertVariable.sessionId),
        eq(schema.variables.name, insertVariable.name)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing variable
      const [updated] = await db.update(schema.variables)
        .set({ values: insertVariable.values ? [...insertVariable.values] : [] })
        .where(eq(schema.variables.id, existing[0].id))
        .returning();
      return updated;
    }
    
    // Create new variable
    const [variable] = await db.insert(schema.variables)
      .values({
        ...insertVariable,
        values: insertVariable.values ? [...insertVariable.values] : []
      })
      .returning();
    return variable;
  }

  async updateVariable(id: string, updateData: Partial<InsertVariable>): Promise<Variable> {
    const setData: any = {};
    if (updateData.name !== undefined) setData.name = updateData.name;
    if (updateData.sessionId !== undefined) setData.sessionId = updateData.sessionId;
    if (updateData.values !== undefined) setData.values = updateData.values ? [...updateData.values] : [];
    
    const [updated] = await db.update(schema.variables)
      .set(setData)
      .where(eq(schema.variables.id, id))
      .returning();
    
    if (!updated) {
      throw new Error("Variable not found");
    }
    
    return updated;
  }

  async deleteVariable(id: string): Promise<void> {
    const result = await db.delete(schema.variables)
      .where(eq(schema.variables.id, id))
      .returning();
    
    if (result.length === 0) {
      throw new Error("Variable not found");
    }
  }

  async addVariableValue(sessionId: string, name: string, value: string): Promise<Variable> {
    // Find variable by name and session
    const existing = await db.select()
      .from(schema.variables)
      .where(and(
        eq(schema.variables.sessionId, sessionId),
        eq(schema.variables.name, name)
      ))
      .limit(1);
    
    if (existing.length === 0) {
      // Create the variable if it doesn't exist
      return await this.createVariable({
        sessionId,
        name,
        values: [value]
      });
    }
    
    const variable = existing[0];
    const currentValues = variable.values || [];
    
    if (!currentValues.includes(value)) {
      const [updated] = await db.update(schema.variables)
        .set({ values: [...currentValues, value] })
        .where(eq(schema.variables.id, variable.id))
        .returning();
      
      return updated;
    }
    
    return variable;
  }
}