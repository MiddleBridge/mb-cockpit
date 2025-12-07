import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Use a function to lazily initialize the client
// This ensures environment variables are checked at runtime, not during module evaluation
function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMessage =
      "Supabase configuration is missing.\n\n" +
      "Please create a .env file in the root directory with:\n" +
      "NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url\n" +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key\n\n" +
      "See SUPABASE_SETUP.md for detailed instructions.\n\n" +
      "Note: After creating/updating .env file, you need to restart the development server.";

    console.error('❌', errorMessage);
    throw new Error(errorMessage);
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

// Create a proxy that lazily initializes the client only when accessed
let clientInstance: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    // Initialize client only when first accessed
    if (!clientInstance) {
      clientInstance = createSupabaseClient();
    }
    
    const value = (clientInstance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(clientInstance);
    }
    return value;
  }
});


