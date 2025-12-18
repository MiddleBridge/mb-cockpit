const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

console.log('🔍 Sprawdzam konfigurację Google OAuth...\n');

if (!fs.existsSync(envPath)) {
  console.log('❌ Plik .env nie istnieje!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

const requiredVars = {
  'NEXT_PUBLIC_GOOGLE_CLIENT_ID': false,
  'GOOGLE_CLIENT_SECRET': false,
  'GMAIL_GOOGLE_CLIENT_SECRET': false,
  'NEXT_PUBLIC_GOOGLE_CLIENT_SECRET': false,
};

let foundClientId = false;
let foundClientSecret = false;

lines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed.startsWith('#') || !trimmed.includes('=')) {
    return;
  }
  
  const [key, ...valueParts] = trimmed.split('=');
  const value = valueParts.join('=').trim();
  
  if (key === 'NEXT_PUBLIC_GOOGLE_CLIENT_ID') {
    foundClientId = true;
    if (value && value !== '' && !value.includes('your-')) {
      console.log(`✅ NEXT_PUBLIC_GOOGLE_CLIENT_ID: ${value.substring(0, 30)}...`);
    } else {
      console.log(`⚠️  NEXT_PUBLIC_GOOGLE_CLIENT_ID: ustawione, ale wartość wygląda na placeholder`);
    }
  }
  
  if (key === 'GOOGLE_CLIENT_SECRET' || key === 'GMAIL_GOOGLE_CLIENT_SECRET' || key === 'NEXT_PUBLIC_GOOGLE_CLIENT_SECRET') {
    foundClientSecret = true;
    if (value && value !== '' && !value.includes('your-')) {
      console.log(`✅ ${key}: ${value.substring(0, 10)}... (ukryte)`);
    } else {
      console.log(`⚠️  ${key}: ustawione, ale wartość wygląda na placeholder`);
    }
  }
});

console.log('\n📊 Podsumowanie:');
if (foundClientId) {
  console.log('✅ Client ID znaleziony');
} else {
  console.log('❌ NEXT_PUBLIC_GOOGLE_CLIENT_ID nie znaleziony w .env');
}

if (foundClientSecret) {
  console.log('✅ Client Secret znaleziony');
} else {
  console.log('❌ Client Secret nie znaleziony!');
  console.log('\n💡 Dodaj jedną z tych zmiennych do .env:');
  console.log('   - GOOGLE_CLIENT_SECRET=twoj-secret');
  console.log('   - GMAIL_GOOGLE_CLIENT_SECRET=twoj-secret');
  console.log('   - NEXT_PUBLIC_GOOGLE_CLIENT_SECRET=twoj-secret');
  console.log('\n⚠️  UWAGA: NEXT_PUBLIC_* zmienne są widoczne w przeglądarce!');
  console.log('   Lepiej użyj GOOGLE_CLIENT_SECRET (bez NEXT_PUBLIC_)');
}

if (!foundClientId || !foundClientSecret) {
  console.log('\n🔄 Po dodaniu zmiennych do .env, zrestartuj serwer:');
  console.log('   1. Zatrzymaj serwer (Ctrl+C)');
  console.log('   2. Uruchom ponownie: npm run dev');
  process.exit(1);
} else {
  console.log('\n✅ Wszystkie wymagane zmienne są ustawione!');
  console.log('🔄 Jeśli nadal masz problemy, zrestartuj serwer (Ctrl+C, potem npm run dev)');
}

