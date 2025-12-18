"use client";

import { useState, useEffect } from "react";

export default function MBPartner() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectMenu, setShowDisconnectMenu] = useState(false);

  useEffect(() => {
    // Get user email from localStorage
    if (typeof window !== 'undefined') {
      const email = localStorage.getItem('gmail_user_email');
      if (email) {
        setUserEmail(email);
        checkGmailConnection(email);
      }
      
      // Check if we just returned from OAuth callback
      const params = new URLSearchParams(window.location.search);
      if (params.get('gmail_connected') === 'true') {
        const userEmailParam = params.get('userEmail');
        if (userEmailParam) {
          localStorage.setItem('gmail_user_email', userEmailParam);
          setUserEmail(userEmailParam);
          // Remove the parameter from URL
          params.delete('gmail_connected');
          params.delete('userEmail');
          const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
          window.history.replaceState({}, '', newUrl);
          // Recheck connection after a short delay
          setTimeout(() => checkGmailConnection(userEmailParam), 500);
        }
      }
    }
  }, []);

  // Close disconnect menu when clicking outside
  useEffect(() => {
    if (!showDisconnectMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setShowDisconnectMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDisconnectMenu]);

  const checkGmailConnection = async (email: string) => {
    try {
      const response = await fetch(`/api/gmail/check-connection?userEmail=${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        setIsGmailConnected(data.connected || false);
      }
    } catch (error) {
      console.error('Error checking Gmail connection:', error);
    }
  };

  const handleConnectGoogle = async () => {
    let emailToUse = userEmail;
    
    if (!emailToUse || emailToUse.trim() === '') {
      const email = prompt('Please enter your Gmail address:');
      if (!email || email.trim() === '') {
        return;
      }
      emailToUse = email.trim();
      localStorage.setItem('gmail_user_email', emailToUse);
      setUserEmail(emailToUse);
    }
    
    await connectGoogleAccount(emailToUse);
  };

  const connectGoogleAccount = async (email: string) => {
    setIsConnecting(true);
    try {
      // Use backend OAuth flow which gives refresh_token
      // Redirect to /api/gmail/auth which will handle the OAuth flow
      window.location.href = `/api/gmail/auth?userEmail=${encodeURIComponent(email)}`;
      // Note: setIsConnecting(false) won't be called because page redirects
    } catch (err: any) {
      console.error('Error connecting Google:', err);
      alert('Failed to connect Google: ' + err.message);
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!userEmail) {
      alert('Brak adresu e-mail. Nie można rozłączyć konta.');
      return;
    }

    const confirmed = confirm('Czy na pewno chcesz rozłączyć konto Google? Będziesz musiał ponownie połączyć konto, aby korzystać z funkcji Gmail i Kalendarza.');
    if (!confirmed) {
      return;
    }

    setIsDisconnecting(true);
    setShowDisconnectMenu(false);
    
    try {
      const response = await fetch('/api/gmail/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to disconnect Google');
      }

      // Update state
      setIsGmailConnected(false);
      alert('Konto Google zostało rozłączone.');
    } catch (err: any) {
      console.error('Error disconnecting Google:', err);
      alert('Nie udało się rozłączyć konta Google: ' + err.message);
    } finally {
      setIsDisconnecting(false);
    }
  };

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
          {isGmailConnected ? (
            <div className="relative">
              <button
                onClick={() => setShowDisconnectMenu(!showDisconnectMenu)}
                className="flex items-center gap-2 px-3 py-2 bg-green-600/20 border border-green-600/50 rounded-lg hover:bg-green-600/30 transition-colors cursor-pointer"
                disabled={isDisconnecting}
              >
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs text-green-400">Google Connected</span>
                {!isDisconnecting && (
                  <span className="text-xs text-green-400">▼</span>
                )}
                {isDisconnecting && (
                  <span className="text-xs text-green-400 animate-spin">⏳</span>
                )}
              </button>
              {showDisconnectMenu && (
                <div className="absolute right-0 top-full mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg z-50 min-w-[200px]">
                  <button
                    onClick={handleDisconnectGoogle}
                    className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-600/20 rounded-t-lg transition-colors"
                  >
                    🔌 Rozłącz konto Google
                  </button>
                  <div className="px-4 py-2 text-[10px] text-neutral-500 border-t border-neutral-700">
                    Email: {userEmail}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleConnectGoogle}
              disabled={isConnecting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isConnecting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>🔗</span>
                  <span>Połącz z Google</span>
                </>
              )}
            </button>
          )}
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





