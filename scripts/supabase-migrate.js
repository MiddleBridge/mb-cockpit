#!/usr/bin/env node

/**
 * Enhanced migration script using Supabase Management API
 * This script reads SQL files and applies them to Supabase
 * 
 * Requirements:
 * 1. Install Supabase CLI: npm install -g supabase
 * 2. Login: supabase login
 * 3. Link project: supabase link --project-ref your-project-ref
 * 
 * Usage:
 *   npm run migrate                    # Apply all pending migrations
 *   npm run migrate <file.sql>         # Apply specific migration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(__dirname, '..');
const MIGRATIONS_LOG_FILE = path.join(__dirname, '../.migrations-log.json');

function getAppliedMigrations() {
  if (!fs.existsSync(MIGRATIONS_LOG_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(MIGRATIONS_LOG_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return [];
  }
}

function markMigrationAsApplied(filename) {
  const applied = getAppliedMigrations();
  if (!applied.includes(filename)) {
    applied.push(filename);
    fs.writeFileSync(MIGRATIONS_LOG_FILE, JSON.stringify(applied, null, 2));
  }
}

function getAllMigrationFiles() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.startsWith('migration-') && file.endsWith('.sql'))
    .sort();
  
  return files.map(file => ({
    filename: file,
    path: path.join(MIGRATIONS_DIR, file)
  }));
}

function checkSupabaseCLI() {
  try {
    execSync('supabase --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

async function applyMigrationWithCLI(migrationPath, filename) {
  console.log(`\n📄 Applying migration: ${filename}`);
  
  try {
    // Use Supabase CLI to apply migration
    // First, we need to copy the migration to supabase/migrations if it exists
    const supabaseMigrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    
    if (fs.existsSync(supabaseMigrationsDir)) {
      // Copy migration file to supabase/migrations with timestamp
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
      const newFilename = `${timestamp}_${filename.replace('migration-', '')}`;
      const targetPath = path.join(supabaseMigrationsDir, newFilename);
      
      fs.copyFileSync(migrationPath, targetPath);
      console.log(`✅ Copied to ${targetPath}`);
      
      // Apply using supabase db push
      console.log('🚀 Pushing migration to Supabase...');
      execSync('supabase db push', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      return true;
    } else {
      console.log('⚠️  Supabase migrations directory not found.');
      console.log('📋 Please run: supabase init');
      return false;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

function showSQL(migrationPath, filename) {
  console.log(`\n📄 Migration: ${filename}`);
  console.log('='.repeat(60));
  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log(sql);
  console.log('='.repeat(60));
  console.log('\n📋 Copy the SQL above and run it in Supabase SQL Editor');
}

async function main() {
  const args = process.argv.slice(2);
  const hasCLI = checkSupabaseCLI();
  
  if (!hasCLI) {
    console.log('⚠️  Supabase CLI not found.');
    console.log('📦 Install it with: npm install -g supabase');
    console.log('🔗 Or visit: https://supabase.com/docs/guides/cli');
    console.log('\n📋 Showing SQL files to apply manually:\n');
  }
  
  if (args.length > 0) {
    // Apply specific migration file
    const migrationFile = args[0];
    const migrationPath = path.isAbsolute(migrationFile) 
      ? migrationFile 
      : path.join(process.cwd(), migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }
    
    const filename = path.basename(migrationPath);
    const applied = getAppliedMigrations();
    
    if (applied.includes(filename)) {
      console.log(`ℹ️  Migration ${filename} has already been applied.`);
      console.log('   To re-apply, remove it from .migrations-log.json');
      return;
    }
    
    if (hasCLI) {
      const success = await applyMigrationWithCLI(migrationPath, filename);
      if (success) {
        markMigrationAsApplied(filename);
      }
    } else {
      showSQL(migrationPath, filename);
    }
  } else {
    // Apply all pending migrations
    const applied = getAppliedMigrations();
    const allMigrations = getAllMigrationFiles();
    const pending = allMigrations.filter(m => !applied.includes(m.filename));
    
    if (pending.length === 0) {
      console.log('✅ All migrations have been applied!');
      return;
    }
    
    console.log(`📦 Found ${pending.length} pending migration(s):`);
    pending.forEach(m => console.log(`   - ${m.filename}`));
    
    if (hasCLI) {
      for (const migration of pending) {
        const success = await applyMigrationWithCLI(migration.path, migration.filename);
        if (success) {
          markMigrationAsApplied(migration.filename);
          console.log(`✅ Migration ${migration.filename} applied successfully\n`);
        } else {
          console.error(`❌ Failed to apply ${migration.filename}`);
          process.exit(1);
        }
      }
    } else {
      console.log('\n📋 SQL to apply:\n');
      for (const migration of pending) {
        showSQL(migration.path, migration.filename);
        console.log('\n');
      }
    }
  }
}

main().catch(console.error);




