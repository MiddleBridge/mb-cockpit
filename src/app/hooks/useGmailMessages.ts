"use client";

import { useState, useEffect } from "react";

interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
}

interface UseGmailMessagesResult {
  messages: GmailMessage[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGmailMessages(
  contactEmail: string | null,
  userEmail: string | null
): UseGmailMessagesResult {
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = async () => {
    if (!contactEmail || !userEmail) {
      setMessages([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        userEmail,
        contactEmail,
        limit: "10",
      });

      const response = await fetch(`/api/gmail/messages?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch messages");
      }

      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err: any) {
      console.error("Error fetching Gmail messages:", err);
      setError(err.message || "Failed to fetch messages");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // DON'T fetch messages automatically - only on manual refresh
  // Messages will be fetched only when user calls refetch() manually
  useEffect(() => {
    // Reset state when contact email changes, but don't fetch automatically
    if (!contactEmail || !userEmail) {
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }
    
    // Don't fetch automatically - user must call refetch() manually
    setMessages([]);
    setLoading(false);
    setError(null);
  }, [contactEmail, userEmail]);

  return {
    messages,
    loading,
    error,
    refetch: fetchMessages,
  };
}

