const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.log('❌ Plik .env nie istnieje!');
  process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

console.log('🔧 Naprawiam plik .env...\n');

// Usuń wszystkie błędne linie GOOGLE_CLIENT_SECRET (które mają Client ID zamiast Secret)
let newLines = [];
let removedCount = 0;

lines.forEach((line, index) => {
  const trimmed = line.trim();
  
  // Sprawdź czy to linia z GOOGLE_CLIENT_SECRET
  if (trimmed.startsWith('GOOGLE_CLIENT_SECRET=')) {
    const value = trimmed.split('=')[1]?.trim() || '';
    
    // Jeśli wartość wygląda jak Client ID (zawiera .apps.googleusercontent.com), usuń tę linię
    if (value.includes('.apps.googleusercontent.com')) {
      console.log(`❌ Usuwam błędną linię ${index + 1}: ${trimmed.substring(0, 60)}...`);
      removedCount++;
      return; // Nie dodawaj tej linii
    }
    
    // Jeśli wartość wygląda jak API Key (zaczyna się od AIza), usuń
    if (value.startsWith('AIza')) {
      console.log(`❌ Usuwam błędną linię ${index + 1}: ${trimmed.substring(0, 60)}...`);
      removedCount++;
      return;
    }
  }
  
  newLines.push(line);
});

// Zapisz poprawiony plik
fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');

console.log(`\n✅ Usunięto ${removedCount} błędnych linii z GOOGLE_CLIENT_SECRET`);
console.log('\n📝 Teraz musisz dodać PRAWDZIWY Client Secret:');
console.log('\n1. Przejdź do Google Cloud Console:');
console.log('   https://console.cloud.google.com/apis/credentials');
console.log('\n2. Kliknij na OAuth 2.0 Client ID:');
console.log('   "MB Cockpit Gmail" (793651169774-4hl1nfablrpf0i3051e52ko7rdoh5t8r)');
console.log('\n3. W sekcji "Client secrets":');
console.log('   - Jeśli widzisz secret kończący się na "...7Fe3", kliknij "Show"');
console.log('   - LUB kliknij "+ Add secret" i utwórz nowy');
console.log('\n4. Skopiuj Client Secret (wygląda jak: GOCSPX-xxxxx lub podobny)');
console.log('\n5. Dodaj do .env:');
console.log('   GOOGLE_CLIENT_SECRET=GOCSPX-twoj-prawdziwy-secret-tutaj');
console.log('\n6. Zrestartuj serwer: npm run dev');

