const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, '', 'utf8');
  console.log('✅ Pusty plik .env został utworzony!');
} else {
  console.log('⚠️ Plik .env już istnieje.');
}

