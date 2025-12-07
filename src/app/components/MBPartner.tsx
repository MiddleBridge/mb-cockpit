"use client";

import { useState } from "react";

export default function MBPartner() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  const handleSend = () => {
    if (inputValue.trim()) {
      // TODO: Send to API and get response
      setMessages([...messages, inputValue]);
      setInputValue("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-neutral-800 bg-neutral-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-neutral-300">MB Partner</span>
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a prompt to manage your business content..."
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
        {messages.length > 0 && (
          <div className="mt-3 space-y-2">
            {messages.map((msg, idx) => (
              <div key={idx} className="text-xs text-neutral-400">
                You: {msg}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}





