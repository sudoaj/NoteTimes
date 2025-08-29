// Session management for anonymous users
export class SessionManager {
  private sessionId: string | null = null;
  private readonly STORAGE_KEY = 'notetimes-session-id';

  constructor() {
    // Try to get session ID from localStorage first
    if (typeof window !== 'undefined') {
      this.sessionId = localStorage.getItem(this.STORAGE_KEY);
    }
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, sessionId);
    }
  }

  clearSession(): void {
    this.sessionId = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  // Get headers for API requests
  getSessionHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.sessionId) {
      headers['x-session-id'] = this.sessionId;
    }
    return headers;
  }
}

// Global session manager instance
export const sessionManager = new SessionManager();

// HTTP interceptor to handle session headers
export function createSessionFetch() {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers);
    
    // Add session headers
    const sessionHeaders = sessionManager.getSessionHeaders();
    Object.entries(sessionHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for cross-origin requests
    });

    // Check for session ID in response headers and update if present
    const responseSessionId = response.headers.get('x-session-id');
    if (responseSessionId && responseSessionId !== sessionManager.getSessionId()) {
      sessionManager.setSessionId(responseSessionId);
    }

    return response;
  };
}

// Enhanced fetch with session management
export const sessionFetch = createSessionFetch();