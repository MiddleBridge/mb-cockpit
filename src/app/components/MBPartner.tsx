"use client";

import { useState, useEffect } from "react";
import * as contactsDb from "../../lib/db/contacts";
import type { Contact } from "../../lib/db/contacts";

interface Message {
  type: "user" | "assistant";
  content: string;
}

export default function MBPartner() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    const contactsData = await contactsDb.getContacts();
    setContacts(contactsData);
  };

  const findContactByName = (name: string): Contact | null => {
    const normalizedName = name.toLowerCase().trim();
    return (
      contacts.find(
        (c) =>
          c.name.toLowerCase() === normalizedName ||
          c.name.toLowerCase().includes(normalizedName) ||
          normalizedName.includes(c.name.toLowerCase())
      ) || null
    );
  };

  const parseTaskRequest = (text: string): {
    action: "add_task" | "unknown";
    taskText?: string;
    contactName?: string;
    priority?: "low" | "mid" | "prio" | "high prio";
  } => {
    const lowerText = text.toLowerCase();

    // Patterns for task creation (Polish and English)
    const taskPatterns = [
      // Polish patterns
      /(?:dodaj|stwórz|utwórz|dodaj zadanie|dodaj task)\s+(?:dla|do|kontaktu)?\s*([^,]+?)(?:\s+dla\s+([^,]+?))?(?:\s+priorytet\s+(low|mid|prio|high|wysoki|średni|niski))?/i,
      /(?:zadanie|task)\s+([^,]+?)(?:\s+dla\s+([^,]+?))?(?:\s+priorytet\s+(low|mid|prio|high|wysoki|średni|niski))?/i,
      // English patterns
      /(?:add|create|new)\s+(?:task|todo)\s+(?:for\s+)?([^,]+?)(?:\s+for\s+([^,]+?))?(?:\s+priority\s+(low|mid|prio|high))?/i,
      /(?:task|todo)\s+([^,]+?)(?:\s+for\s+([^,]+?))?(?:\s+priority\s+(low|mid|prio|high))?/i,
    ];

    for (const pattern of taskPatterns) {
      const match = text.match(pattern);
      if (match) {
        // Try to extract task text and contact name
        let taskText = match[1]?.trim();
        let contactName = match[2]?.trim();

        // If no contact name in match, try to find it in the text
        if (!contactName) {
          // Look for "dla X" or "for X" patterns
          const contactPattern = /(?:dla|for)\s+([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż\s]+)/i;
          const contactMatch = text.match(contactPattern);
          if (contactMatch) {
            contactName = contactMatch[1].trim();
            // Remove contact name from task text
            taskText = taskText.replace(new RegExp(`(?:dla|for)\\s+${contactName}`, "i"), "").trim();
          }
        }

        // If still no contact, the first match might be the contact name
        // Try to find a contact name in the text
        if (!contactName && taskText) {
          for (const contact of contacts) {
            if (text.toLowerCase().includes(contact.name.toLowerCase())) {
              contactName = contact.name;
              taskText = text
                .replace(new RegExp(`(?:dodaj|stwórz|utwórz|add|create|new|task|zadanie)`, "gi"), "")
                .replace(new RegExp(`(?:dla|for)\\s+${contact.name}`, "gi"), "")
                .replace(contact.name, "")
                .trim();
              break;
            }
          }
        }

        // If we still don't have a clear separation, try a simpler approach
        // Look for known contact names in the text
        if (!contactName) {
          for (const contact of contacts) {
            const nameIndex = lowerText.indexOf(contact.name.toLowerCase());
            if (nameIndex !== -1) {
              contactName = contact.name;
              // Extract task text as everything before or after the contact name
              const parts = text.split(new RegExp(contact.name, "i"));
              taskText = parts.find((p) => p.trim() && !p.toLowerCase().includes("dla") && !p.toLowerCase().includes("for"))?.trim() || taskText;
              break;
            }
          }
        }

        // Priority mapping
        let priority: "low" | "mid" | "prio" | "high prio" = "mid";
        const priorityMatch = match[3] || text.match(/(?:priorytet|priority)\s+(low|mid|prio|high|wysoki|średni|niski)/i)?.[1];
        if (priorityMatch) {
          const p = priorityMatch.toLowerCase();
          if (p === "high" || p === "wysoki" || p === "high prio") priority = "high prio";
          else if (p === "prio") priority = "prio";
          else if (p === "mid" || p === "średni") priority = "mid";
          else if (p === "low" || p === "niski") priority = "low";
        }

        return {
          action: "add_task",
          taskText: taskText || text,
          contactName: contactName,
          priority,
        };
      }
    }

    // Fallback: if text contains task-related keywords, try to extract
    if (
      lowerText.includes("zadanie") ||
      lowerText.includes("task") ||
      lowerText.includes("todo") ||
      lowerText.includes("dodaj") ||
      lowerText.includes("add")
    ) {
      // Try to find a contact name
      let contactName: string | undefined;
      for (const contact of contacts) {
        if (lowerText.includes(contact.name.toLowerCase())) {
          contactName = contact.name;
          break;
        }
      }

      return {
        action: "add_task",
        taskText: text,
        contactName,
        priority: "mid",
      };
    }

    return { action: "unknown" };
  };

  const handleAddTask = async (taskText: string, contactName?: string, priority: "low" | "mid" | "prio" | "high prio" = "mid") => {
    let contact: Contact | null = null;

    if (contactName) {
      contact = findContactByName(contactName);
      if (!contact) {
        return `Nie znaleziono kontaktu "${contactName}". Dostępne kontakty: ${contacts.slice(0, 5).map((c) => c.name).join(", ")}${contacts.length > 5 ? "..." : ""}`;
      }
    } else {
      // If no contact specified, use the first contact or ask user
      if (contacts.length === 0) {
        return "Brak kontaktów w systemie. Najpierw dodaj kontakt.";
      }
      if (contacts.length === 1) {
        contact = contacts[0];
      } else {
        return `Proszę podać kontakt dla zadania. Dostępne kontakty: ${contacts.slice(0, 10).map((c) => c.name).join(", ")}${contacts.length > 10 ? "..." : ""}`;
      }
    }

    if (!contact) {
      return "Nie udało się znaleźć kontaktu.";
    }

    const newTask = {
      id: Date.now().toString(),
      text: taskText,
      completed: false,
      status: "ongoing" as const,
      priority,
      created_at: new Date().toISOString(),
    };

    const updatedTasks = [...(contact.tasks || []), newTask];
    const result = await contactsDb.updateContact(contact.id, { tasks: updatedTasks });

    if (result) {
      await loadContacts();
      window.dispatchEvent(new Event("graph-data-updated"));
      return `✓ Zadanie "${taskText}" zostało dodane do kontaktu ${contact.name}`;
    } else {
      return "Błąd podczas dodawania zadania.";
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMessage = inputValue.trim();
    setMessages((prev) => [...prev, { type: "user", content: userMessage }]);
    setInputValue("");
    setIsProcessing(true);

    try {
      const parsed = parseTaskRequest(userMessage);

      if (parsed.action === "add_task") {
        const response = await handleAddTask(
          parsed.taskText || userMessage,
          parsed.contactName,
          parsed.priority
        );
        setMessages((prev) => [...prev, { type: "assistant", content: response }]);
      } else {
        // Unknown command - provide helpful response
        setMessages((prev) => [
          ...prev,
          {
            type: "assistant",
            content: `Nie rozpoznałem komendy. Przykłady:\n• "Dodaj zadanie [tekst] dla [kontakt]"\n• "Task [tekst] for [contact]"\n• "Zadanie [tekst] dla [kontakt] priorytet wysoki"`,
          },
        ]);
      }
    } catch (error) {
      console.error("Error processing request:", error);
      setMessages((prev) => [
        ...prev,
        { type: "assistant", content: "Wystąpił błąd podczas przetwarzania żądania." },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-b border-neutral-800 bg-neutral-900 p-2">
      <div className="max-w-7xl mx-auto flex gap-3 items-center pl-48">
        {/* Left: Input area */}
        <div className="flex-shrink-0 flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isProcessing ? "bg-yellow-500 animate-pulse" : "bg-emerald-500"}`} />
          <span className="text-xs text-neutral-300">MB Partner</span>
        </div>
        <div className="flex gap-2 flex-1 min-w-0">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a prompt..."
            disabled={isProcessing}
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isProcessing}
            className="px-3 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isProcessing ? "..." : "Send"}
          </button>
        </div>

        {/* Right: Messages area - compact horizontal scroll */}
        <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto max-h-16">
          {messages.length > 0 ? (
            <div className="flex gap-2 items-center">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex-shrink-0 rounded px-2 py-1 text-xs max-w-[200px] ${
                    msg.type === "user"
                      ? "bg-neutral-800 text-neutral-200"
                      : "bg-emerald-600/30 text-emerald-200 border border-emerald-500/40"
                  }`}
                >
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis block">{msg.content}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-neutral-500 flex items-center">
              Messages...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



