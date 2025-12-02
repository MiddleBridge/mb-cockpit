"use client";

import { useState, useEffect } from "react";
import * as googleCalendar from "../../lib/google-calendar";
import { format, formatDistanceToNow } from "date-fns";
import type { CalendarEvent, EventWeight } from "../../lib/google-calendar";

interface Props {
  onSync?: () => void;
}

interface EventEditFormProps {
  event: CalendarEvent | null;
  onSave: (updated: Partial<CalendarEvent>) => void;
  onCancel: () => void;
  isNew?: boolean;
}

const WEIGHT_OPTIONS: { value: EventWeight; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-blue-400' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
  { value: 'high', label: 'High', color: 'text-orange-400' },
  { value: 'critical', label: 'Critical', color: 'text-red-400' },
];

const WEIGHT_COLORS: Record<EventWeight, string> = {
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function stripHtml(html: string | undefined): string {
  if (!html) return "";
  if (typeof document === 'undefined') {
    // Server-side: simple regex to remove HTML tags
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function EventEditForm({ event, onSave, onCancel, isNew = false }: EventEditFormProps) {
  const formatDateTimeForInput = (dateTime?: string, date?: string): string => {
    if (dateTime) {
      // Convert ISO string to datetime-local format (YYYY-MM-DDTHH:mm)
      const d = new Date(dateTime);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    if (date) {
      return date;
    }
    return "";
  };

  const defaultStart = new Date();
  defaultStart.setHours(9, 0, 0, 0);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setHours(10, 0, 0, 0);

  const [formData, setFormData] = useState({
    summary: event?.summary || "",
    description: event?.description ? stripHtml(event.description) : "",
    location: event?.location || "",
    startDateTime: event 
      ? formatDateTimeForInput(event.start?.dateTime, event.start?.date)
      : formatDateTimeForInput(defaultStart.toISOString(), undefined),
    endDateTime: event
      ? formatDateTimeForInput(event.end?.dateTime, event.end?.date)
      : formatDateTimeForInput(defaultEnd.toISOString(), undefined),
    isAllDay: event ? (!event.start?.dateTime && !!event.start?.date) : false,
    weight: (event?.weight || 'medium') as EventWeight,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updated: Partial<CalendarEvent> = {
      summary: formData.summary,
      description: formData.description,
      location: formData.location,
      weight: formData.weight,
    };

    if (formData.isAllDay) {
      updated.start = {
        date: formData.startDateTime,
      };
      updated.end = {
        date: formData.endDateTime,
      };
    } else {
      const startDate = new Date(formData.startDateTime);
      const endDate = new Date(formData.endDateTime);
      updated.start = {
        dateTime: startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      updated.end = {
        dateTime: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
    
    onSave(updated);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="text"
        value={formData.summary}
        onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
        placeholder="Event title"
        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
        required
      />
      <textarea
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        placeholder="Description"
        rows={3}
        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
      />
      <input
        type="text"
        value={formData.location}
        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
        placeholder="Location"
        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
      />
      <div>
        <label className="block text-[10px] text-neutral-500 mb-1">Priority/Weight</label>
        <select
          value={formData.weight}
          onChange={(e) => setFormData({ ...formData, weight: e.target.value as EventWeight })}
          className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
        >
          {WEIGHT_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="allDay"
            checked={formData.isAllDay}
            onChange={(e) => {
              const isAllDay = e.target.checked;
              setFormData({
                ...formData,
                isAllDay,
                startDateTime: isAllDay 
                  ? formData.startDateTime.split('T')[0]
                  : formData.startDateTime.includes('T') 
                    ? formData.startDateTime 
                    : `${formData.startDateTime}T09:00`,
                endDateTime: isAllDay
                  ? formData.endDateTime.split('T')[0]
                  : formData.endDateTime.includes('T')
                    ? formData.endDateTime
                    : `${formData.endDateTime}T10:00`,
              });
            }}
            className="rounded"
          />
          <label htmlFor="allDay" className="text-[10px] text-neutral-400">All day event</label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-neutral-500 mb-0.5">Start</label>
            <input
              type={formData.isAllDay ? "date" : "datetime-local"}
              value={formData.startDateTime}
              onChange={(e) => setFormData({ ...formData, startDateTime: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] text-neutral-500 mb-0.5">End</label>
            <input
              type={formData.isAllDay ? "date" : "datetime-local"}
              value={formData.endDateTime}
              onChange={(e) => setFormData({ ...formData, endDateTime: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white"
              required
            />
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 px-2 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-2 py-1.5 bg-neutral-700 text-neutral-300 rounded text-xs hover:bg-neutral-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function GoogleCalendarIntegration({ onSync }: Props) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [eventDetails, setEventDetails] = useState<Record<string, CalendarEvent>>({});
  const [weightFilter, setWeightFilter] = useState<EventWeight | 'all'>('all');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      loadUpcomingEvents();
      // Refresh events every 5 minutes
      const interval = setInterval(loadUpcomingEvents, 5 * 60 * 1000);
      return () => clearInterval(interval);
    } else {
      setEvents([]);
    }
  }, [isSignedIn]);

  const checkAuthStatus = async () => {
    try {
      const signedIn = await googleCalendar.isSignedIn();
      setIsSignedIn(signedIn);
    } catch (error) {
      console.error("Error checking auth status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setLoading(true);
      await googleCalendar.signIn();
      setIsSignedIn(true);
      await loadUpcomingEvents();
    } catch (error) {
      console.error("Error signing in:", error);
      alert("Failed to sign in to Google Calendar. Please check your Google API configuration.");
    } finally {
      setLoading(false);
    }
  };

  const loadUpcomingEvents = async () => {
    if (!isSignedIn) return;
    
    try {
      setLoadingEvents(true);
      const upcomingEvents = await googleCalendar.listUpcomingEvents(10);
      setEvents(upcomingEvents);
    } catch (error) {
      console.error("Error loading calendar events:", error);
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  const formatEventTime = (event: CalendarEvent) => {
    if (!event.start) return "";
    
    const startDate = event.start.dateTime 
      ? new Date(event.start.dateTime)
      : event.start.date 
      ? new Date(event.start.date)
      : null;
    
    const endDate = event.end?.dateTime 
      ? new Date(event.end.dateTime)
      : event.end?.date 
      ? new Date(event.end.date)
      : null;
    
    if (!startDate) return "";
    
    const now = new Date();
    const isToday = startDate.toDateString() === now.toDateString();
    const isTomorrow = startDate.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    
    let timeStr = "";
    if (isToday) {
      timeStr = `Today ${format(startDate, "HH:mm")}`;
    } else if (isTomorrow) {
      timeStr = `Tomorrow ${format(startDate, "HH:mm")}`;
    } else if (startDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      timeStr = format(startDate, "EEE HH:mm");
    } else {
      timeStr = format(startDate, "MMM d, HH:mm");
    }

    if (endDate && event.start.dateTime) {
      const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
      if (duration > 0) {
        if (duration < 60) {
          timeStr += ` (${Math.round(duration)}min)`;
        } else {
          const hours = Math.floor(duration / 60);
          const mins = Math.round(duration % 60);
          timeStr += ` (${hours}h${mins > 0 ? ` ${mins}min` : ''})`;
        }
      }
    }

    return timeStr;
  };

  const stripHtml = (html: string | undefined): string => {
    if (!html) return "";
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const loadEventDetails = async (eventId: string) => {
    if (eventDetails[eventId]) return;
    
    try {
      const details = await googleCalendar.getEventDetails(eventId);
      setEventDetails(prev => ({ ...prev, [eventId]: details }));
    } catch (error) {
      console.error("Error loading event details:", error);
    }
  };

  const toggleEventExpanded = async (eventId: string) => {
    if (expandedEvents.has(eventId)) {
      setExpandedEvents(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    } else {
      setExpandedEvents(prev => new Set(prev).add(eventId));
      await loadEventDetails(eventId);
    }
  };

  const handleEditEvent = async (event: CalendarEvent) => {
    if (!event.id) return;
    
    try {
      setLoadingEvents(true);
      await loadEventDetails(event.id);
      setEditingEvent(event.id);
      setExpandedEvents(prev => new Set(prev).add(event.id!));
    } catch (error) {
      console.error("Error loading event for edit:", error);
      alert("Failed to load event details for editing.");
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleSaveEvent = async (eventId: string, updatedEvent: Partial<CalendarEvent>) => {
    try {
      setLoadingEvents(true);
      await googleCalendar.updateCalendarEvent(eventId, updatedEvent as CalendarEvent);
      setEditingEvent(null);
      await loadUpcomingEvents();
    } catch (error) {
      console.error("Error updating event:", error);
      alert("Failed to update event.");
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    
    try {
      setLoadingEvents(true);
      await googleCalendar.deleteCalendarEvent(eventId);
      await loadUpcomingEvents();
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Failed to delete event.");
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleCreateEvent = async (newEvent: Partial<CalendarEvent>) => {
    try {
      setLoadingEvents(true);
      await googleCalendar.createCalendarEvent(newEvent as CalendarEvent);
      setCreatingEvent(false);
      await loadUpcomingEvents();
    } catch (error) {
      console.error("Error creating event:", error);
      alert("Failed to create event.");
    } finally {
      setLoadingEvents(false);
    }
  };

  const getWeightDisplay = (weight?: EventWeight) => {
    if (!weight) return null;
    const option = WEIGHT_OPTIONS.find(opt => opt.value === weight);
    return (
      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${WEIGHT_COLORS[weight]}`}>
        {option?.label || weight}
      </span>
    );
  };

  const getWeightSortOrder = (weight?: EventWeight): number => {
    const order: Record<EventWeight, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return order[weight || 'medium'];
  };

  const filteredAndSortedEvents = events
    .filter(event => weightFilter === 'all' || event.weight === weightFilter)
    .sort((a, b) => {
      const weightDiff = getWeightSortOrder(a.weight) - getWeightSortOrder(b.weight);
      if (weightDiff !== 0) return weightDiff;
      // If same weight, sort by start time
      const aStart = a.start?.dateTime ? new Date(a.start.dateTime).getTime() : 0;
      const bStart = b.start?.dateTime ? new Date(b.start.dateTime).getTime() : 0;
      return aStart - bStart;
    });

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await googleCalendar.signOut();
      setIsSignedIn(false);
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-xs text-neutral-400">
        Checking Google Calendar connection...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Connection status */}
      <div className="flex items-center gap-2">
        {isSignedIn ? (
          <>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-neutral-300">Connected to Google Calendar</span>
            </div>
            <button
              onClick={handleSignOut}
              className="text-xs px-2 py-1 bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600 transition-colors"
            >
              Disconnect
            </button>
            <button
              onClick={loadUpcomingEvents}
              disabled={loadingEvents}
              className="text-xs px-2 py-1 bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600 transition-colors disabled:opacity-50"
            >
              {loadingEvents ? "Loading..." : "Refresh"}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-neutral-600"></span>
              <span className="text-neutral-400">Not connected</span>
            </div>
            <button
              onClick={handleSignIn}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Connect Google Calendar
            </button>
          </>
        )}
      </div>

      {/* Upcoming events */}
      {isSignedIn && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold">
              Upcoming Events ({filteredAndSortedEvents.length})
            </h4>
            <button
              onClick={() => setCreatingEvent(true)}
              className="text-[10px] px-2 py-1 bg-green-600/30 text-green-400 rounded hover:bg-green-600/50 transition-colors"
            >
              + New Event
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-neutral-500">Filter by weight:</label>
            <select
              value={weightFilter}
              onChange={(e) => setWeightFilter(e.target.value as EventWeight | 'all')}
              className="text-[10px] bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white"
            >
              <option value="all">All</option>
              {WEIGHT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {creatingEvent && (
            <div className="p-2.5 bg-neutral-800/60 border border-neutral-700/50 rounded">
              <EventEditForm
                event={null}
                onSave={handleCreateEvent}
                onCancel={() => setCreatingEvent(false)}
                isNew={true}
              />
            </div>
          )}
          {loadingEvents ? (
            <div className="text-xs text-neutral-500">Loading events...</div>
          ) : filteredAndSortedEvents.length === 0 ? (
            <div className="text-xs text-neutral-500">No upcoming events</div>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {filteredAndSortedEvents.map((event) => {
                const details = eventDetails[event.id || ""] || event;
                const isEditing = editingEvent === event.id;
                const isExpanded = expandedEvents.has(event.id || "");
                
                return (
                  <div
                    key={event.id}
                    className="p-2.5 bg-neutral-800/60 border border-neutral-700/50 rounded text-xs hover:bg-neutral-800/80 transition-colors"
                  >
                    {!isEditing ? (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => event.id && toggleEventExpanded(event.id)}
                              className="text-left w-full"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <div className="font-medium text-neutral-200 hover:text-white transition-colors flex-1">
                                  {event.summary || "No title"}
                                  <span className="ml-1 text-neutral-500 text-[9px]">
                                    {isExpanded ? "▼" : "▶"}
                                  </span>
                                </div>
                                {getWeightDisplay(event.weight)}
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="mt-2 space-y-1.5">
                                {details.description && (
                                  <div className="text-neutral-400 text-[10px] whitespace-pre-wrap">
                                    {stripHtml(details.description)}
                                  </div>
                                )}
                                {details.location && (
                                  <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                                    <span>📍</span>
                                    <span>{details.location}</span>
                                  </div>
                                )}
                                {details.attendees && details.attendees.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-1 text-[10px] text-neutral-500 mb-1">
                                      <span>👥</span>
                                      <span>{details.attendees.length} {details.attendees.length === 1 ? 'attendee' : 'attendees'}</span>
                                    </div>
                                    <div className="text-[9px] text-neutral-600 space-y-0.5 max-h-20 overflow-y-auto pl-3">
                                      {details.attendees.map((attendee, idx) => (
                                        <div key={idx} className="truncate">
                                          {attendee.displayName || attendee.email}
                                          {attendee.responseStatus && attendee.responseStatus !== 'needsAction' && (
                                            <span className="ml-1 text-neutral-700">
                                              ({attendee.responseStatus === 'accepted' ? '✓' : attendee.responseStatus === 'declined' ? '✗' : '?'})
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {details.organizer && (
                                  <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                                    <span>👤</span>
                                    <span>Organizer: {details.organizer.displayName || details.organizer.email}</span>
                                  </div>
                                )}
                                {details.hangoutLink && (
                                  <div>
                                    <a
                                      href={details.hangoutLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] text-green-400 hover:text-green-300 inline-flex items-center gap-1"
                                    >
                                      🎥 Join meeting
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                            {!isExpanded && details.description && (
                              <div className="text-neutral-400 text-[10px] mt-1 line-clamp-2">
                                {stripHtml(details.description)}
                              </div>
                            )}
                            {!isExpanded && details.location && (
                              <div className="flex items-center gap-1 text-[10px] text-neutral-500 mt-1">
                                <span>📍</span>
                                <span className="truncate">{details.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-neutral-700/50">
                          <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                            <span>📅</span>
                            <span>{formatEventTime(details)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {details.htmlLink && (
                              <a
                                href={details.htmlLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] px-1.5 py-0.5 bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600 transition-colors"
                                title="Open in Google Calendar"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Open
                              </a>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditEvent(event);
                              }}
                              className="text-[10px] px-1.5 py-0.5 bg-blue-600/30 text-blue-400 rounded hover:bg-blue-600/50 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                event.id && handleDeleteEvent(event.id);
                              }}
                              className="text-[10px] px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <EventEditForm
                        event={details}
                        onSave={(updated) => event.id && handleSaveEvent(event.id, updated)}
                        onCancel={() => setEditingEvent(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

