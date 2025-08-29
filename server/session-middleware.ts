import type { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";
import { IStorage } from "./storage";

export interface SessionRequest extends Request {
  sessionId: string;
}

export function createSessionMiddleware(storage: IStorage) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let sessionId = req.headers['x-session-id'] as string;
      
      // If no session ID in header, try cookie
      if (!sessionId) {
        sessionId = req.cookies?.sessionId;
      }
      
      // If still no session ID, create a new one
      if (!sessionId) {
        sessionId = nanoid(21); // 21 characters for URL-safe unique ID
        
        // Create session in storage
        await storage.createSession({ sessionId });
        
        // Set cookie for browser
        res.cookie('sessionId', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
        });
      } else {
        // Check if session exists, if not create it
        const existingSession = await storage.getSession(sessionId);
        if (!existingSession) {
          await storage.createSession({ sessionId });
        } else {
          // Update last activity
          await storage.updateSessionActivity(sessionId);
        }
      }
      
      // Add session ID to request
      (req as SessionRequest).sessionId = sessionId;
      
      // Send session ID in response header for client-side storage
      res.header('x-session-id', sessionId);
      
      next();
    } catch (error) {
      console.error('Session middleware error:', error);
      next(error);
    }
  };
}