// Quick test to check if .env is loaded correctly
require('dotenv').config();

console.log('Testing .env variables:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_ACCESS_TOKEN:', process.env.SUPABASE_ACCESS_TOKEN ? '✅ Set' : '❌ Missing');

if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ACCESS_TOKEN) {
  console.log('\n✅ Ready to run migrations!');
  console.log('Run: npm run migrate');
} else {
  console.log('\n❌ Missing required keys. Check JAK_ZNALEZC_KLUCZE_SUPABASE.md');
}



