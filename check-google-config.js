const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.log('❌ Plik .env nie istnieje!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

console.log('🔍 Sprawdzam konfigurację Google OAuth z pliku .env:\n');

let foundClientId = false;
let foundClientSecret = false;
let clientIdValue = '';
let clientSecretValue = '';
let clientIdLine = 0;
let clientSecretLine = 0;

lines.forEach((line, index) => {
  const trimmed = line.trim();
  if (trimmed.startsWith('#') || !trimmed.includes('=')) {
    return;
  }
  
  const [key, ...valueParts] = trimmed.split('=');
  const value = valueParts.join('=').trim();
  
  if (key === 'NEXT_PUBLIC_GOOGLE_CLIENT_ID' || 
      key === 'GMAIL_PUBLIC_GOOGLE_CLIENT_ID' || 
      key === 'GOOGLE_CLIENT_ID') {
    foundClientId = true;
    clientIdValue = value;
    clientIdLine = index + 1;
    console.log(`✅ Linia ${index + 1}: ${key}`);
    console.log(`   Wartość: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
  }
  
  if (key === 'GOOGLE_CLIENT_SECRET' || 
      key === 'GMAIL_GOOGLE_CLIENT_SECRET' || 
      key === 'NEXT_PUBLIC_GOOGLE_CLIENT_SECRET') {
    foundClientSecret = true;
    clientSecretValue = value;
    clientSecretLine = index + 1;
    console.log(`✅ Linia ${index + 1}: ${key}`);
    console.log(`   Wartość: ${value.substring(0, 10)}...${value.substring(value.length - 5)} (ukryte)`);
  }
});

console.log('\n📊 Podsumowanie:');
if (foundClientId) {
  console.log(`✅ Client ID znaleziony w linii ${clientIdLine}`);
  // Sprawdź czy pasuje do tego z konsoli
  if (clientIdValue.includes('793651169774-4hl1nfablrpf0i3051e52ko7rdoh5t8r')) {
    console.log('   ✅ Client ID pasuje do tego z Google Cloud Console!');
  } else {
    console.log('   ⚠️  Client ID może nie pasować do tego z konsoli');
    console.log('   Oczekiwany: 793651169774-4hl1nfablrpf0i3051e52ko7rdoh5t8r.apps.googleusercontent.com');
  }
} else {
  console.log('❌ Client ID nie znaleziony!');
  console.log('   Dodaj do .env: NEXT_PUBLIC_GOOGLE_CLIENT_ID=793651169774-4hl1nfablrpf0i3051e52ko7rdoh5t8r.apps.googleusercontent.com');
}

if (foundClientSecret) {
  console.log(`✅ Client Secret znaleziony w linii ${clientSecretLine}`);
  if (clientSecretValue.length < 10) {
    console.log('   ⚠️  Client Secret wydaje się za krótki');
  }
  if (clientSecretValue.includes('your-') || clientSecretValue.includes('placeholder')) {
    console.log('   ⚠️  Client Secret wygląda na placeholder - zamień na prawdziwy!');
  }
} else {
  console.log('❌ Client Secret nie znaleziony!');
  console.log('   Dodaj do .env jedną z:');
  console.log('   - GOOGLE_CLIENT_SECRET=twoj-secret');
  console.log('   - GMAIL_GOOGLE_CLIENT_SECRET=twoj-secret');
  console.log('   - NEXT_PUBLIC_GOOGLE_CLIENT_SECRET=twoj-secret');
}

if (!foundClientId || !foundClientSecret) {
  console.log('\n💡 Jeśli masz Client Secret w Google Cloud Console:');
  console.log('   1. Kliknij "+ Add secret" w sekcji Client secrets');
  console.log('   2. Skopiuj nowy secret (będzie widoczny tylko raz!)');
  console.log('   3. Dodaj do .env jako GOOGLE_CLIENT_SECRET=...');
  console.log('   4. Zrestartuj serwer (npm run dev)');
  process.exit(1);
} else {
  console.log('\n✅ Wszystkie wymagane zmienne są ustawione!');
  console.log('🔄 Jeśli nadal masz błąd "invalid_client":');
  console.log('   1. Upewnij się, że Client ID i Secret są z TEGO SAMEGO credentials w Google Cloud Console');
  console.log('   2. Zrestartuj serwer (Ctrl+C, potem npm run dev)');
  console.log('   3. Sprawdź logi serwera po próbie połączenia');
}

