const fs = require('fs');
const path = require('path');

const publicEnvPath = path.join(__dirname, 'public', '.env');
const rootEnvPath = path.join(__dirname, '.env');

if (fs.existsSync(publicEnvPath)) {
  console.log('📖 Czytam plik public/.env...');
  const content = fs.readFileSync(publicEnvPath, 'utf8');
  
  // Zmień prefiksy VITE_ na NEXT_PUBLIC_
  const fixedContent = content
    .replace(/VITE_SUPABASE_URL/g, 'NEXT_PUBLIC_SUPABASE_URL')
    .replace(/VITE_SUPABASE_ANON_KEY/g, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  console.log('💾 Zapisuję poprawiony plik .env w katalogu głównym...');
  fs.writeFileSync(rootEnvPath, fixedContent, 'utf8');
  
  console.log('✅ Gotowe! Plik .env został utworzony w katalogu głównym z poprawionymi prefiksami.');
  console.log('🔄 Zrestartuj serwer deweloperski (npm run dev)');
} else {
  console.log('❌ Nie znaleziono pliku public/.env');
}

