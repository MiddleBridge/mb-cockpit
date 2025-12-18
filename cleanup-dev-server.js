const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧹 Cleaning up Next.js dev server...\n');

// 1. Kill Node.js processes
try {
  console.log('1. Killing Node.js processes...');
  if (process.platform === 'win32') {
    try {
      execSync('taskkill /IM node.exe /F', { stdio: 'ignore' });
      console.log('   ✅ Node.js processes killed');
    } catch (e) {
      console.log('   ℹ️  No Node.js processes found or already killed');
    }
  } else {
    try {
      execSync('pkill -f node', { stdio: 'ignore' });
      console.log('   ✅ Node.js processes killed');
    } catch (e) {
      console.log('   ℹ️  No Node.js processes found or already killed');
    }
  }
} catch (error) {
  console.log('   ⚠️  Could not kill processes:', error.message);
}

// 2. Remove .next folder
const nextFolder = path.join(__dirname, '.next');
if (fs.existsSync(nextFolder)) {
  try {
    console.log('2. Removing .next folder...');
    fs.rmSync(nextFolder, { recursive: true, force: true });
    console.log('   ✅ .next folder removed');
  } catch (error) {
    console.log('   ⚠️  Could not remove .next folder:', error.message);
    console.log('   💡 Try manually deleting the .next folder');
  }
} else {
  console.log('2. .next folder does not exist (already clean)');
}

// 3. Remove lock file if exists
const lockFile = path.join(__dirname, '.next', 'dev', 'lock');
if (fs.existsSync(lockFile)) {
  try {
    console.log('3. Removing lock file...');
    fs.unlinkSync(lockFile);
    console.log('   ✅ Lock file removed');
  } catch (error) {
    console.log('   ⚠️  Could not remove lock file:', error.message);
  }
} else {
  console.log('3. Lock file does not exist');
}

console.log('\n✅ Cleanup complete! You can now run: npm run dev');

