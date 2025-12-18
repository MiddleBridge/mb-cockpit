import { useEffect, useState } from 'react';
import { ContactFile } from '@/types/email';

type UseContactFilesResult = {
  files: ContactFile[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  connectGmail: () => void;
  refreshConnection?: () => void;
  fetchFiles?: () => Promise<void>;
};

/**
 * Hook to fetch email files (PDF/DOC) for a contact from Gmail
 * @param contactEmail - Email address of the contact (null/undefined to skip fetching)
 * @param userEmail - Email address of the logged-in user (for Gmail authentication)
 * @returns Object with files array, loading state, error message, connection status, and connect function
 */
export function useContactFiles(
  contactEmail: string | null | undefined,
  userEmail: string | null | undefined
): UseContactFilesResult {
  const [files, setFiles] = useState<ContactFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);

  // Check Gmail connection status
  useEffect(() => {
    if (!userEmail || userEmail.trim() === '') {
      setIsConnected(false);
      setCheckingConnection(false);
      return;
    }

    const checkConnection = async () => {
      console.log('🔍 useContactFiles: Checking connection for:', userEmail);
      try {
        const url = `/api/gmail/check-connection?userEmail=${encodeURIComponent(userEmail)}`;
        console.log('🔍 useContactFiles: Fetching:', url);
        const response = await fetch(url);
        console.log('🔍 useContactFiles: Response status:', response.status, response.statusText);
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 useContactFiles: Response data:', data);
          const connected = data.connected || false;
          setIsConnected(connected);
          if (!connected) {
            console.warn('⚠️ Gmail not connected for:', userEmail);
          } else {
            console.log('✅ Gmail IS connected for:', userEmail);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Error checking Gmail connection:', errorData);
          setIsConnected(false);
        }
      } catch (err) {
        console.error('❌ Exception checking Gmail connection:', err);
        setIsConnected(false);
      } finally {
        setCheckingConnection(false);
      }
    };

    checkConnection();

    // Check if we just returned from OAuth callback
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('gmail_connected') === 'true') {
        // Remove the parameter from URL
        params.delete('gmail_connected');
        const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.replaceState({}, '', newUrl);
        // Recheck connection after a short delay
        setTimeout(checkConnection, 500);
      }
    }
  }, [userEmail]);

  // DON'T fetch files automatically - only on manual refresh
  // Files will be fetched only when user clicks refresh button
  useEffect(() => {
    // Reset state when contact email changes, but don't fetch automatically
    if (!contactEmail || contactEmail.trim() === '' || !userEmail || userEmail.trim() === '') {
      setFiles([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Reset state if not connected
    if (!isConnected) {
      setFiles([]);
      setLoading(false);
      setError('Gmail not connected');
      return;
    }

    // Don't fetch automatically - user must click refresh
    setFiles([]);
    setLoading(false);
    setError(null);
  }, [contactEmail, userEmail, isConnected]);

  const connectGmail = async () => {
    if (!userEmail) {
      alert('Please provide your email address to connect Gmail');
      return;
    }

    // Use Google Identity Services (frontend OAuth) - no Client Secret needed
    try {
      // Load Google Identity Services script if not already loaded
      if (typeof window === 'undefined') {
        alert('This feature requires a browser');
        return;
      }

      if (!(window as any).google?.accounts?.oauth2) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
        
        await new Promise((resolve, reject) => {
          script.onload = () => {
            let attempts = 0;
            const checkInterval = setInterval(() => {
              attempts++;
              if ((window as any).google?.accounts?.oauth2) {
                clearInterval(checkInterval);
                resolve(true);
              } else if (attempts >= 50) {
                clearInterval(checkInterval);
                reject(new Error('Google Identity Services failed to load'));
              }
            }, 200);
          };
          script.onerror = reject;
        });
      }

      const google = (window as any).google;
      
      // Get client ID from API (server-side env var)
      let clientId: string;
      try {
        const response = await fetch('/api/gmail/client-id');
        const data = await response.json();
        if (!data.clientId) {
          throw new Error('Gmail Client ID not configured');
        }
        clientId = data.clientId;
      } catch (err) {
        throw new Error('Failed to get Gmail Client ID. Make sure GMAIL_PUBLIC_GOOGLE_CLIENT_ID is set in .env');
      }

      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        callback: async (response: any) => {
          if (response.error) {
            console.error('Gmail OAuth error:', response.error);
            alert('Failed to connect Gmail: ' + response.error);
            return;
          }

          // Store tokens in database via API
          try {
            const storeResponse = await fetch('/api/gmail/store-tokens', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userEmail,
                accessToken: response.access_token,
                expiresIn: response.expires_in || 3600,
              }),
            });

            if (!storeResponse.ok) {
              const errorData = await storeResponse.json();
              throw new Error(errorData.error || 'Failed to store tokens');
            }

            // Refresh the connection status and reload files
            window.location.reload();
          } catch (err: any) {
            console.error('Error storing Gmail tokens:', err);
            alert('Failed to save Gmail connection: ' + err.message);
          }
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      console.error('Error connecting Gmail:', err);
      alert('Failed to connect Gmail: ' + err.message);
    }
  };

  const refreshConnection = () => {
    setCheckingConnection(true);
    setIsConnected(false);
    // Re-trigger connection check
    if (userEmail) {
      const checkConnection = async () => {
        try {
          const response = await fetch(
            `/api/gmail/check-connection?userEmail=${encodeURIComponent(userEmail)}`
          );
          if (response.ok) {
            const data = await response.json();
            setIsConnected(data.connected || false);
          } else {
            setIsConnected(false);
          }
        } catch (err) {
          setIsConnected(false);
        } finally {
          setCheckingConnection(false);
        }
      };
      checkConnection();
    }
  };

  // Manual fetch function - only called when user clicks refresh
  const fetchFiles = async () => {
    // Skip if no contact email or user email provided
    if (!contactEmail || contactEmail.trim() === '' || !userEmail || userEmail.trim() === '') {
      setFiles([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Skip if not connected
    if (!isConnected) {
      setFiles([]);
      setLoading(false);
      setError('Gmail not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/email/files-by-contact?email=${encodeURIComponent(contactEmail)}&userEmail=${encodeURIComponent(userEmail)}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        setError(errorData.error || 'Failed to fetch files');
        setFiles([]);
        return;
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  return { files, loading, error, isConnected: isConnected && !checkingConnection, connectGmail, refreshConnection, fetchFiles };
}

