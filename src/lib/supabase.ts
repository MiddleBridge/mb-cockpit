import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Use a function to lazily initialize the client
// This ensures environment variables are checked at runtime, not during module evaluation
function createSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Debug: sprawdź czy zmienne są ustawione
  if (typeof window !== 'undefined') {
    console.log('🔍 Supabase config check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      urlLength: supabaseUrl?.length || 0,
      keyLength: supabaseAnonKey?.length || 0,
    });
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return null instead of throwing to allow app to start
    // The proxy will handle this gracefully with a mock client
    if (typeof window !== 'undefined') {
      console.warn('⚠️ Supabase URL or Key missing:', {
        url: supabaseUrl ? '✅' : '❌',
        key: supabaseAnonKey ? '✅' : '❌',
      });
    }
    return null;
  }

  const client = createClient(supabaseUrl, supabaseAnonKey);
  if (typeof window !== 'undefined') {
    console.log('✅ Supabase client created successfully');
  }
  return client;
}

// Create a mock client that returns empty results when Supabase is not configured
function createMockClient(): any {
  // Only log once to avoid spam
  if (typeof window !== 'undefined' && !(window as any).__supabase_warned) {
    console.warn('⚠️ Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env file. See SUPABASE_SETUP.md for instructions.');
    (window as any).__supabase_warned = true;
  }
  
  const mockResult = {
    data: null,
    error: {
      message: 'Supabase is not configured',
      details: 'Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env file',
      hint: 'See SUPABASE_SETUP.md for instructions',
      code: 'PGRST_CONFIG_ERROR'
    },
    status: 500,
    statusText: 'Configuration Error'
  };
  
  const mockPromise = Promise.resolve(mockResult);
  
  // Create a chainable query builder mock that mimics Supabase's query builder API
  const createQueryBuilder = () => {
    const builder: any = {
      // Chainable methods that return the builder itself
      select: (_columns?: string) => builder,
      order: (_column: string, _options?: { ascending?: boolean }) => builder,
      eq: (_column: string, _value: any) => builder,
      is: (_column: string, _value: any) => builder,
      limit: (_count: number) => builder,
      // Terminal methods that return promises
      single: () => mockPromise,
      maybeSingle: () => mockPromise,
      // Make it thenable (can be awaited directly)
      then: (onResolve: any, onReject?: any) => mockPromise.then(onResolve, onReject),
      catch: (onReject: any) => mockPromise.catch(onReject),
    };
    return builder;
  };

  const mockFrom = (table: string) => {
    const queryBuilder = createQueryBuilder();
    return {
      select: (_columns?: string) => queryBuilder,
      insert: (_data: any) => queryBuilder,
      update: (_data: any) => queryBuilder,
      delete: () => queryBuilder,
      upsert: (_data: any) => queryBuilder,
    };
  };

  return {
    from: mockFrom,
    storage: {
      from: () => ({
        upload: () => mockPromise,
        download: () => mockPromise,
        list: () => mockPromise,
        remove: () => mockPromise,
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
    auth: {
      getUser: () => mockPromise,
      signInWithPassword: () => mockPromise,
      signOut: () => mockPromise,
    },
  };
}

// Create a proxy that lazily initializes the client only when accessed
let clientInstance: SupabaseClient | any = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    // Initialize client only when first accessed
    if (!clientInstance) {
      const client = createSupabaseClient();
      if (!client) {
        // Use mock client if configuration is missing
        clientInstance = createMockClient();
      } else {
        clientInstance = client;
      }
    }
    
    const value = (clientInstance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(clientInstance);
    }
    return value;
  }
});


