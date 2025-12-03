import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  const errorMessage = 
    'Supabase configuration is missing.\n\n' +
    'Please create a .env file in the root directory with:\n' +
    'NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url\n' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key\n\n' +
    'See SUPABASE_SETUP.md for detailed instructions.';
  
  console.error('❌', errorMessage);
  
  // Throw a more helpful error
  throw new Error(errorMessage);
}

export const supabase = createClient(url, key);


