/**
 * Google Calendar Integration
 * 
 * This module handles integration with Google Calendar API
 * Requires:
 * - NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env
 * - Google Calendar API enabled in Google Cloud Console
 */

export type EventWeight = 'low' | 'medium' | 'high' | 'critical';

export interface CalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  organizer?: {
    email: string;
    displayName?: string;
  };
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  htmlLink?: string;
  hangoutLink?: string;
  extendedProperties?: {
    private?: {
      weight?: EventWeight;
    };
  };
  weight?: EventWeight; // Helper property for easier access
}

export interface TaskToEvent {
  taskId: string;
  contactId: string;
  text: string;
  dueDate: string;
  notes?: string;
  assignees?: string[];
  contactName: string;
  contactEmail?: string;
}

/**
 * Load Google Calendar API
 */
export async function loadGoogleCalendarAPI(): Promise<typeof gapi> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Calendar API can only be loaded in browser'));
      return;
    }

    const gapi = (window as any).gapi;
    if (gapi && gapi.client && gapi.client.calendar) {
      resolve(gapi);
      return;
    }

    // Load gapi script
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      const gapiLoaded = (window as any).gapi;
      if (!gapiLoaded) {
        reject(new Error('Failed to load Google API'));
        return;
      }
      // Load client library only (without auth2 which is deprecated)
      // We use Google Identity Services for auth, not gapi.auth2
      gapiLoaded.load('client', () => {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

        const initConfig: any = {
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        };

        // API key is required for calendar API
        if (apiKey) {
          initConfig.apiKey = apiKey;
        } else {
          console.warn('NEXT_PUBLIC_GOOGLE_API_KEY is not set. Some features may not work.');
        }

        gapiLoaded.client.init(initConfig).then(() => {
          resolve(gapiLoaded);
        }).catch((error: any) => {
          console.error('Google API init error:', error);
          const errorMessage = error?.error || error?.message || error?.details || JSON.stringify(error);
          reject(new Error(`Failed to initialize Google API: ${errorMessage}`));
        });
      });
    };
    script.onerror = () => reject(new Error('Failed to load Google API script'));
    document.body.appendChild(script);
  });
}

// Store token in memory and localStorage
const TOKEN_STORAGE_KEY = 'google_calendar_access_token';

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

let accessToken: string | null = getStoredToken();

/**
 * Check if user is signed in
 */
export async function isSignedIn(): Promise<boolean> {
  // Check if we have a stored token
  const storedToken = getStoredToken();
  if (storedToken) {
    accessToken = storedToken;
    return true;
  }
  return false;
}

/**
 * Wait for Google Identity Services to load
 */
function waitForGoogleIdentityServices(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Calendar API can only be used in browser'));
      return;
    }

    const google = (window as any).google;
    if (google && google.accounts && google.accounts.oauth2) {
      resolve(google);
      return;
    }

    // Wait for script to load (max 10 seconds)
    let attempts = 0;
    const maxAttempts = 50;
    const checkInterval = setInterval(() => {
      attempts++;
      const googleLoaded = (window as any).google;
      if (googleLoaded && googleLoaded.accounts && googleLoaded.accounts.oauth2) {
        clearInterval(checkInterval);
        resolve(googleLoaded);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        reject(new Error('Google Identity Services failed to load. Please refresh the page.'));
      }
    }, 200);
  });
}

/**
 * Sign in to Google Calendar using Google Identity Services
 */
export async function signIn(): Promise<void> {
  const google = await waitForGoogleIdentityServices();
  
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set');
  }

  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        accessToken = response.access_token;
        setStoredToken(response.access_token);
        resolve();
      },
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * Sign out from Google Calendar
 */
export async function signOut(): Promise<void> {
  const google = (window as any).google;
  if (google && google.accounts && google.accounts.oauth2 && accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      setStoredToken(null);
    });
  } else {
    accessToken = null;
    setStoredToken(null);
  }
}

/**
 * Get access token
 */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Convert task to calendar event
 */
export function taskToEvent(task: TaskToEvent): CalendarEvent {
  const startDate = new Date(task.dueDate);
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 1); // 1 hour duration by default

  const attendees: Array<{ email: string }> = [];
  if (task.contactEmail) {
    attendees.push({ email: task.contactEmail });
  }

  const description = [
    `Task: ${task.text}`,
    task.notes ? `Notes: ${task.notes}` : '',
    task.assignees && task.assignees.length > 0 
      ? `Assignees: ${task.assignees.join(', ')}` 
      : '',
    `Contact: ${task.contactName}`,
  ].filter(Boolean).join('\n\n');

  return {
    summary: task.text,
    description,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    attendees: attendees.length > 0 ? attendees : undefined,
    reminders: {
      useDefault: true,
    },
  };
}

/**
 * Create calendar event from task
 */
export async function createCalendarEvent(event: CalendarEvent): Promise<CalendarEvent> {
  const gapi = await loadGoogleCalendarAPI();
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated. Please sign in first.');
  }

  // Set access token for this request
  gapi.client.setToken({ access_token: token });
  
  // Prepare event with extendedProperties for weight
  const eventToCreate: any = { ...event };
  if (event.weight) {
    eventToCreate.extendedProperties = {
      ...eventToCreate.extendedProperties,
      private: {
        ...eventToCreate.extendedProperties?.private,
        weight: event.weight,
      },
    };
  }
  // Remove helper weight property before sending
  delete eventToCreate.weight;
  
  const response = await gapi.client.calendar.events.insert({
    calendarId: 'primary',
    resource: eventToCreate,
  });

  const createdEvent = response.result;
  const weight = createdEvent.extendedProperties?.private?.weight as EventWeight | undefined;
  return {
    ...createdEvent,
    weight,
  };
}

/**
 * Update calendar event
 */
export async function updateCalendarEvent(eventId: string, event: CalendarEvent): Promise<CalendarEvent> {
  const gapi = await loadGoogleCalendarAPI();
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated. Please sign in first.');
  }

  gapi.client.setToken({ access_token: token });
  
  // Prepare event with extendedProperties for weight
  const eventToUpdate: any = { ...event };
  if (event.weight) {
    eventToUpdate.extendedProperties = {
      ...eventToUpdate.extendedProperties,
      private: {
        ...eventToUpdate.extendedProperties?.private,
        weight: event.weight,
      },
    };
  }
  // Remove helper weight property before sending
  delete eventToUpdate.weight;
  
  const response = await gapi.client.calendar.events.update({
    calendarId: 'primary',
    eventId,
    resource: eventToUpdate,
  });

  const updatedEvent = response.result;
  const weight = updatedEvent.extendedProperties?.private?.weight as EventWeight | undefined;
  return {
    ...updatedEvent,
    weight,
  };
}

/**
 * Delete calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const gapi = await loadGoogleCalendarAPI();
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated. Please sign in first.');
  }

  gapi.client.setToken({ access_token: token });
  
  await gapi.client.calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });
}

/**
 * List upcoming events
 */
export async function listUpcomingEvents(maxResults: number = 10): Promise<CalendarEvent[]> {
  const gapi = await loadGoogleCalendarAPI();
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated. Please sign in first.');
  }

  gapi.client.setToken({ access_token: token });
  
  const response = await gapi.client.calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    showDeleted: false,
    singleEvents: true,
    maxResults,
    orderBy: 'startTime',
  });

  const events = (response.result.items || []).map((event: any) => {
    // Extract weight from extendedProperties
    const weight = event.extendedProperties?.private?.weight as EventWeight | undefined;
    return {
      ...event,
      weight,
    };
  });

  return events;
}

/**
 * Get event details by ID
 */
export async function getEventDetails(eventId: string): Promise<CalendarEvent> {
  const gapi = await loadGoogleCalendarAPI();
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated. Please sign in first.');
  }

  gapi.client.setToken({ access_token: token });
  
  const response = await gapi.client.calendar.events.get({
    calendarId: 'primary',
    eventId: eventId,
  });

  const event = response.result;
  // Extract weight from extendedProperties
  const weight = event.extendedProperties?.private?.weight as EventWeight | undefined;
  return {
    ...event,
    weight,
  };
}

/**
 * Sync task to calendar (create or update)
 */
export async function syncTaskToCalendar(
  task: TaskToEvent,
  existingEventId?: string
): Promise<CalendarEvent | null> {
  try {
    const event = taskToEvent(task);
    
    if (existingEventId) {
      return await updateCalendarEvent(existingEventId, event);
    } else {
      return await createCalendarEvent(event);
    }
  } catch (error) {
    console.error('Error syncing task to calendar:', error);
    return null;
  }
}

