import { createClient } from '@supabase/supabase-js'

// Next.js requires NEXT_PUBLIC_ prefix for browser-accessible env variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Validate URL format
const isValidUrl = (url: string) => {
  if (!url) return false
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Only create client if we have valid URL
if (!isValidUrl(supabaseUrl)) {
  console.error('Invalid or missing Supabase URL:', supabaseUrl)
  console.error('NEXT_PUBLIC_SUPABASE_URL env var:', process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET')
  throw new Error(
    `Invalid Supabase URL. Please set NEXT_PUBLIC_SUPABASE_URL in your .env.local file. ` +
    `Current value: "${supabaseUrl}"`
  )
}

if (!supabaseAnonKey) {
  console.error('Missing Supabase anon key')
  throw new Error('Please set NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)


