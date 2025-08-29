import { type Note, type InsertNote, type Variable, type InsertVariable, type UserSession, type InsertUserSession } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Sessions
  createSession(session: InsertUserSession): Promise<UserSession>;
  getSession(sessionId: string): Promise<UserSession | null>;
  updateSessionActivity(sessionId: string): Promise<void>;
  
  // Notes
  getNotes(sessionId: string): Promise<Note[]>;
  getNotesByFolder(sessionId: string, folder: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  deleteNote(sessionId: string, noteId: string): Promise<void>;
  deleteAllNotes(sessionId: string): Promise<void>;
  getFolders(sessionId: string): Promise<string[]>;
  createFolder(sessionId: string, name: string): Promise<string>;
  
  // Variables
  getVariables(sessionId: string): Promise<Variable[]>;
  createVariable(variable: InsertVariable): Promise<Variable>;
  updateVariable(id: string, variable: Partial<InsertVariable>): Promise<Variable>;
  deleteVariable(id: string): Promise<void>;
  addVariableValue(sessionId: string, name: string, value: string): Promise<Variable>;
}

export class MemStorage implements IStorage {
  private notes: Map<string, Note>;
  private variables: Map<string, Variable>;
  private sessions: Map<string, UserSession>;
  private folders: Map<string, Set<string>>;

  constructor() {
    this.notes = new Map();
    this.variables = new Map();
    this.sessions = new Map();
    this.folders = new Map();
  }

  async createSession(insertSession: InsertUserSession): Promise<UserSession> {
    const session: UserSession = {
      id: randomUUID(),
      sessionId: insertSession.sessionId,
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };
    this.sessions.set(insertSession.sessionId, session);
    
    // Initialize default folder for this session
    if (!this.folders.has(insertSession.sessionId)) {
      this.folders.set(insertSession.sessionId, new Set(["General"]));
    }
    
    // Add some default variables for this session
    await this.createVariable({ sessionId: insertSession.sessionId, name: "user", values: ["John Doe", "Jane Smith", "Bob Wilson"] });
    await this.createVariable({ sessionId: insertSession.sessionId, name: "company", values: ["Acme Inc", "Tech Corp", "Innovation Labs"] });
    await this.createVariable({ sessionId: insertSession.sessionId, name: "project", values: ["Alpha", "Beta", "Gamma"] });
    
    return session;
  }

  async getSession(sessionId: string): Promise<UserSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActiveAt = new Date();
    }
  }

  async getNotes(sessionId: string): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter(note => note.sessionId === sessionId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const id = randomUUID();
    const note: Note = {
      ...insertNote,
      id,
      createdAt: new Date(),
      tags: insertNote.tags ? [...insertNote.tags] : [],
      folder: insertNote.folder || "General",
    };
    this.notes.set(id, note);
    return note;
  }

  async deleteNote(sessionId: string, noteId: string): Promise<void> {
    const note = this.notes.get(noteId);
    if (!note) {
      throw new Error("Note not found");
    }
    if (note.sessionId !== sessionId) {
      throw new Error("Note does not belong to this session");
    }
    this.notes.delete(noteId);
  }

  async deleteAllNotes(sessionId: string): Promise<void> {
    const notesToDelete = Array.from(this.notes.entries())
      .filter(([, note]) => note.sessionId === sessionId)
      .map(([id]) => id);
    
    notesToDelete.forEach(id => this.notes.delete(id));
  }

  async getVariables(sessionId: string): Promise<Variable[]> {
    return Array.from(this.variables.values())
      .filter(variable => variable.sessionId === sessionId);
  }

  async createVariable(insertVariable: InsertVariable): Promise<Variable> {
    const id = randomUUID();
    const variable: Variable = {
      ...insertVariable,
      id,
    };
    this.variables.set(id, variable);
    return variable;
  }

  async updateVariable(id: string, updateData: Partial<InsertVariable>): Promise<Variable> {
    const existing = this.variables.get(id);
    if (!existing) {
      throw new Error("Variable not found");
    }
    
    const updated: Variable = {
      ...existing,
      ...updateData,
    };
    this.variables.set(id, updated);
    return updated;
  }

  async deleteVariable(id: string): Promise<void> {
    if (!this.variables.has(id)) {
      throw new Error("Variable not found");
    }
    this.variables.delete(id);
  }

  async getNotesByFolder(sessionId: string, folder: string): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter(note => note.sessionId === sessionId && note.folder === folder)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getFolders(sessionId: string): Promise<string[]> {
    // Combine explicitly created folders with folders from notes
    const sessionFolders = this.folders.get(sessionId) || new Set(["General"]);
    const folders = new Set(sessionFolders);
    
    for (const note of this.notes.values()) {
      if (note.sessionId === sessionId) {
        folders.add(note.folder || "General");
      }
    }
    return Array.from(folders).sort();
  }

  async createFolder(sessionId: string, name: string): Promise<string> {
    const trimmedName = name.trim();
    if (!this.folders.has(sessionId)) {
      this.folders.set(sessionId, new Set(["General"]));
    }
    this.folders.get(sessionId)!.add(trimmedName);
    return trimmedName;
  }

  async addVariableValue(sessionId: string, name: string, value: string): Promise<Variable> {
    // Find variable by name and session
    const variable = Array.from(this.variables.values())
      .find(v => v.sessionId === sessionId && v.name === name);
    if (!variable) {
      throw new Error("Variable not found");
    }
    
    // Add value if it doesn't already exist
    const currentValues = variable.values || [];
    if (!currentValues.includes(value)) {
      const updated: Variable = {
        ...variable,
        values: [...currentValues, value],
      };
      this.variables.set(variable.id, updated);
      return updated;
    }
    
    return variable;
  }
}

import { DbStorage } from "./db-storage";

// Use database storage
export const storage: IStorage = new DbStorage();
