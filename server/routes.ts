import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertNoteSchema, insertVariableSchema } from "@shared/schema";
import { z } from "zod";
import { createSessionMiddleware, type SessionRequest } from "./session-middleware";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Apply session middleware to all API routes
  app.use("/api", createSessionMiddleware(storage));
  
  // Notes routes
  app.get("/api/notes", async (req, res) => {
    try {
      const { sessionId } = req as SessionRequest;
      const notes = await storage.getNotes(sessionId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", async (req, res) => {
    try {
      const { sessionId } = req as SessionRequest;
      const noteData = insertNoteSchema.parse({ ...req.body, sessionId });
      const note = await storage.createNote(noteData);
      res.json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid note data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create note" });
      }
    }
  });

  app.delete("/api/notes/:id", async (req, res) => {
    try {
      const { sessionId } = req as SessionRequest;
      const { id } = req.params;
      await storage.deleteNote(sessionId, id);
      res.json({ message: "Note deleted" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete note" });
    }
  });

  app.delete("/api/notes", async (req, res) => {
    try {
      const { sessionId } = req as SessionRequest;
      await storage.deleteAllNotes(sessionId);
      res.json({ message: "All notes deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete notes" });
    }
  });

  // Folder routes
  app.get("/api/folders", async (req, res) => {
    try {
      const { sessionId } = req as SessionRequest;
      const folders = await storage.getFolders(sessionId);
      res.json(folders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch folders" });
    }
  });

  app.get("/api/notes/folder/:folder", async (req, res) => {
    try {
      const { sessionId } = req as SessionRequest;
      const { folder } = req.params;
      const notes = await storage.getNotesByFolder(sessionId, decodeURIComponent(folder));
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notes by folder" });
    }
  });

  // Variables routes
  app.get("/api/variables", async (req, res) => {
    try {
      const { sessionId } = req as SessionRequest;
      const variables = await storage.getVariables(sessionId);
      res.json(variables);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch variables" });
    }
  });

  app.post("/api/variables", async (req, res) => {
    try {
      const { sessionId } = req as SessionRequest;
      const variableData = insertVariableSchema.parse({ ...req.body, sessionId });
      const variable = await storage.createVariable(variableData);
      res.json(variable);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid variable data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create variable" });
      }
    }
  });

  app.put("/api/variables/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = insertVariableSchema.partial().parse(req.body);
      const variable = await storage.updateVariable(id, updateData);
      res.json(variable);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid variable data", errors: error.errors });
      } else {
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update variable" });
      }
    }
  });

  app.delete("/api/variables/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteVariable(id);
      res.json({ message: "Variable deleted" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete variable" });
    }
  });

  app.post("/api/variables/:name/values", async (req, res) => {
    try {
      const { sessionId } = req as SessionRequest;
      const { name } = req.params;
      const { value } = req.body;
      
      if (!value || typeof value !== 'string') {
        return res.status(400).json({ message: "Value is required and must be a string" });
      }
      
      const variable = await storage.addVariableValue(sessionId, name, value);
      res.json(variable);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to add variable value" });
    }
  });

  // Folder management routes
  app.post("/api/folders", async (req, res) => {
    try {
      const { sessionId } = req as SessionRequest;
      const { name } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Folder name is required and must be a string" });
      }
      
      const folderName = await storage.createFolder(sessionId, name);
      res.json({ name: folderName, message: "Folder created successfully" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create folder" });
    }
  });

  app.delete("/api/folders/:name", async (req, res) => {
    try {
      const { sessionId } = req as SessionRequest;
      const { name } = req.params;
      const folderName = decodeURIComponent(name);
      
      // Check if folder has notes
      const notesInFolder = await storage.getNotesByFolder(sessionId, folderName);
      if (notesInFolder.length > 0) {
        return res.status(400).json({ message: "Cannot delete folder with notes. Please move or delete notes first." });
      }
      
      res.json({ message: `Folder "${folderName}" deleted` });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete folder" });
    }
  });

  // Export routes
  app.get("/api/export/text", async (req, res) => {
    try {
      const { sessionId } = req as SessionRequest;
      const notes = await storage.getNotes(sessionId);
      let exportText = "NoteTimes Export\n";
      exportText += "================\n\n";
      
      const notesByDate = notes.reduce((acc, note) => {
        const date = new Date(note.createdAt).toLocaleDateString();
        if (!acc[date]) acc[date] = [];
        acc[date].push(note);
        return acc;
      }, {} as Record<string, typeof notes>);

      Object.entries(notesByDate).forEach(([date, dayNotes]) => {
        exportText += `${date}\n`;
        exportText += "-".repeat(date.length) + "\n";
        dayNotes.forEach(note => {
          const time = new Date(note.createdAt).toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          exportText += `${time} ${note.content}\n`;
          if (note.tags && note.tags.length > 0) {
            exportText += `Tags: ${note.tags.join(', ')}\n`;
          }
          exportText += "\n";
        });
        exportText += "\n";
      });

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="notes.txt"');
      res.send(exportText);
    } catch (error) {
      res.status(500).json({ message: "Failed to export notes" });
    }
  });

  app.get("/api/export/json", async (req, res) => {
    try {
      const { sessionId } = req as SessionRequest;
      const notes = await storage.getNotes(sessionId);
      const variables = await storage.getVariables(sessionId);
      
      const exportData = {
        exportedAt: new Date().toISOString(),
        notes,
        variables
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="notes.json"');
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ message: "Failed to export notes" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
