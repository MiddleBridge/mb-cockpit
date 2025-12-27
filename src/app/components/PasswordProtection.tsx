"use client";

import { useState, useEffect } from 'react';

interface PasswordProtectionProps {
  children?: React.ReactNode;
}

export default function PasswordProtection({ children }: PasswordProtectionProps) {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const authStatus = localStorage.getItem('mb_cockpit_authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Get password from environment variable or use default
    // In production, you should set MB_COCKPIT_PASSWORD in Vercel environment variables
    const correctPassword = process.env.NEXT_PUBLIC_MB_COCKPIT_PASSWORD || 'mb2024';

    if (password === correctPassword) {
      localStorage.setItem('mb_cockpit_authenticated', 'true');
      setIsAuthenticated(true);
    } else {
      setError('Nieprawidłowe hasło. Spróbuj ponownie.');
      setPassword('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('mb_cockpit_authenticated');
    setIsAuthenticated(false);
    setPassword('');
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-neutral-950 z-[9999] flex items-center justify-center">
        <div className="text-neutral-400">Ładowanie...</div>
      </div>
    );
  }

  // User is authenticated, show app content
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Show password form if not authenticated
  return (
    <div className="fixed inset-0 bg-neutral-950 z-[9999] flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 shadow-xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">MB Cockpit</h1>
            <p className="text-sm text-neutral-400">Wprowadź hasło, aby uzyskać dostęp</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Hasło"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-4 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!password.trim()}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Zaloguj się
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-neutral-500">
              Aby zmienić hasło, ustaw zmienną środowiskową <code className="bg-neutral-800 px-1 py-0.5 rounded">NEXT_PUBLIC_MB_COCKPIT_PASSWORD</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

