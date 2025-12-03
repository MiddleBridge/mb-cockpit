#!/usr/bin/env node

/**
 * Automatic migration script using Supabase Management API
 * This script automatically applies SQL migrations to Supabase
 * 
 * Requirements:
 * - SUPABASE_ACCESS_TOKEN in .env (get it from Supabase Dashboard > Settings > Access Tokens)
 * - NEXT_PUBLIC_SUPABASE_URL in .env
 * 
 * Usage:
 *   node scripts/auto-migrate.js                    # Apply all pending migrations
 *   node scripts/auto-migrate.js <file.sql>        # Apply specific migration
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Management API requires ACCESS_TOKEN, not SERVICE_ROLE_KEY
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL in .env');
  process.exit(1);
}

if (!SUPABASE_ACCESS_TOKEN && !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_ACCESS_TOKEN or SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('\n📖 How to get SUPABASE_ACCESS_TOKEN:');
  console.error('   1. Go to https://app.supabase.com');
  console.error('   2. Click your account (top right) > Account Settings');
  console.error('   3. Access Tokens > Generate new token');
  console.error('   4. Copy token to .env as SUPABASE_ACCESS_TOKEN');
  console.error('\n   OR use SUPABASE_SERVICE_ROLE_KEY (but it may not work with Management API)');
  console.error('   Get it from: Settings > API > service_role key');
  process.exit(1);
}

// Use ACCESS_TOKEN for Management API, fallback to SERVICE_ROLE_KEY
const tokenToUse = SUPABASE_ACCESS_TOKEN || SUPABASE_SERVICE_ROLE_KEY;

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 
                  SUPABASE_URL.match(/\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Could not extract project ref from SUPABASE_URL');
  console.error('   URL format should be: https://xxxxx.supabase.co');
  process.exit(1);
}

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
  const migrationsDir = path.join(__dirname, '..');
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.startsWith('migration-') && file.endsWith('.sql'))
    .sort();
  
  return files.map(file => ({
    filename: file,
    path: path.join(migrationsDir, file)
  }));
}

async function applyMigration(migrationPath, filename) {
  console.log(`\n📄 Applying migration: ${filename}`);
  
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  try {
    // Use Supabase client with service role key to execute SQL directly
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, tokenToUse, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log(`   🔗 Connecting to Supabase project: ${projectRef}...`);
    
    // Split SQL into individual statements
    // Handle DO $$ blocks properly - they can contain semicolons inside
    const statements = [];
    let currentStatement = '';
    let inDoBlock = false;
    let doBlockDepth = 0;
    
    const lines = sql.split('\n');
    for (let line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comment-only lines
      if (trimmedLine.startsWith('--') && !inDoBlock) {
        continue;
      }
      
      // Check for DO $$ block start
      if (/DO\s+\$\$/.test(trimmedLine)) {
        inDoBlock = true;
        doBlockDepth = 1;
        currentStatement += line + '\n';
        continue;
      }
      
      // Check for END $$ block end
      if (inDoBlock && /END\s+\$\$/.test(trimmedLine)) {
        currentStatement += line;
        if (trimmedLine.endsWith(';')) {
          statements.push(currentStatement.trim());
          currentStatement = '';
          inDoBlock = false;
          doBlockDepth = 0;
        } else {
          currentStatement += '\n';
        }
        continue;
      }
      
      if (inDoBlock) {
        // Inside DO block - add everything
        currentStatement += line + '\n';
      } else {
        // Outside DO block - split by semicolons, but handle multi-line statements
        // Check if this line ends a statement (has semicolon and is not inside CASE/WHEN/ELSE)
        if (trimmedLine.endsWith(';')) {
          currentStatement += trimmedLine;
          // Check if we're in the middle of a CASE statement
          const hasCase = /CASE\s/i.test(currentStatement);
          const hasEnd = /\bEND\b/i.test(trimmedLine);
          
          // If we have CASE but no END yet, continue building the statement
          if (hasCase && !hasEnd) {
            currentStatement += ' ';
            continue;
          }
          
          if (currentStatement.trim().length > 0) {
            statements.push(currentStatement.trim());
          }
          currentStatement = '';
        } else if (trimmedLine.length > 0) {
          currentStatement += trimmedLine + ' ';
        }
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }
    
    // Filter out empty statements and comments
    const filteredStatements = statements
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.match(/^\s*--/));

    // Execute each statement using RPC or direct query
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement || statement.trim() === ';') continue;

      try {
        // Check if statement is CREATE TABLE (requires Management API) or ALTER TABLE (might work)
        const isCreateTable = /^\s*CREATE\s+TABLE/i.test(statement);
        const isAlterTable = /^\s*ALTER\s+TABLE/i.test(statement);
        const isDoBlock = /^\s*DO\s+\$\$/i.test(statement);
        const isCreateIndex = /^\s*CREATE\s+INDEX/i.test(statement);
        const isCreatePolicy = /^\s*CREATE\s+POLICY/i.test(statement);
        const isDropPolicy = /^\s*DROP\s+POLICY/i.test(statement);
        const isDropTable = /^\s*DROP\s+TABLE/i.test(statement);
        const isUpdate = /^\s*UPDATE\s+/i.test(statement);
        const isInsert = /^\s*INSERT\s+/i.test(statement);
        const isDelete = /^\s*DELETE\s+/i.test(statement);

        // For CREATE TABLE, CREATE INDEX, CREATE POLICY, DROP POLICY, DROP TABLE, UPDATE, INSERT, DELETE, and DO blocks, we need Management API
        if (isDoBlock || isCreateTable || isCreateIndex || isCreatePolicy || isDropPolicy || isDropTable || isUpdate || isInsert || isDelete) {
          if (!SUPABASE_ACCESS_TOKEN) {
            const stmtType = isCreateTable ? 'CREATE TABLE' : isDoBlock ? 'DO block' : isCreateIndex ? 'CREATE INDEX' : isCreatePolicy ? 'CREATE POLICY' : isDropPolicy ? 'DROP POLICY' : isDropTable ? 'DROP TABLE' : isUpdate ? 'UPDATE' : isInsert ? 'INSERT' : isDelete ? 'DELETE' : 'statement';
            console.log(`   ⚠️  ${stmtType} detected - requires SUPABASE_ACCESS_TOKEN`);
            console.log(`   📋 This migration needs to be run manually in Supabase SQL Editor`);
            throw new Error(`${stmtType} requires SUPABASE_ACCESS_TOKEN (not SERVICE_ROLE_KEY)`);
          }
          
          const stmtType = isCreateTable ? 'CREATE TABLE' : isDoBlock ? 'DO block' : isCreateIndex ? 'CREATE INDEX' : isCreatePolicy ? 'CREATE POLICY' : isDropPolicy ? 'DROP POLICY' : isDropTable ? 'DROP TABLE' : isUpdate ? 'UPDATE' : isInsert ? 'INSERT' : isDelete ? 'DELETE' : 'statement';
          console.log(`   ⚠️  Using Management API for ${stmtType}...`);
          const managementUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
          const mgmtResponse = await fetch(managementUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ACCESS_TOKEN
            },
            body: JSON.stringify({ query: statement })
          });

          if (!mgmtResponse.ok) {
            const errorText = await mgmtResponse.text();
            console.error(`   ❌ Management API Error (${mgmtResponse.status}):`, errorText);
            throw new Error(`Failed to execute SQL: ${errorText}`);
          }
        } else if (isAlterTable) {
          // ALTER TABLE might work through Supabase client, but let's try Management API first if available
          if (SUPABASE_ACCESS_TOKEN) {
            console.log(`   ⚠️  Using Management API for ALTER TABLE...`);
            const managementUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
            const mgmtResponse = await fetch(managementUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ACCESS_TOKEN
              },
              body: JSON.stringify({ query: statement })
            });

            if (!mgmtResponse.ok) {
              const errorText = await mgmtResponse.text();
              console.error(`   ❌ Management API Error (${mgmtResponse.status}):`, errorText);
              throw new Error(`Failed to execute SQL: ${errorText}`);
            }
          } else {
            // Try RPC function (if it exists) for ALTER TABLE
            const { data, error } = await supabase.rpc('exec_sql', { 
              sql: statement 
            });

            if (error) {
              console.log(`   ⚠️  RPC not available, ALTER TABLE needs manual execution or ACCESS_TOKEN`);
              throw new Error('ALTER TABLE requires manual execution or Management API with ACCESS_TOKEN');
            }
          }
        } else {
          // Try RPC function for other statements (if it exists)
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql: statement 
          });

          if (error) {
            console.log(`   ⚠️  RPC not available, statement needs manual execution`);
            throw new Error('RPC function not available');
          }
        }

        console.log(`   ✅ Statement ${i + 1}/${statements.length} executed`);
      } catch (stmtError) {
        // If both methods fail, we need manual execution
        console.error(`   ❌ Error executing statement ${i + 1}:`, stmtError.message);
        throw stmtError;
      }
    }

    console.log(`   ✅ Migration applied successfully`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return false;
  }
}


async function main() {
  const args = process.argv.slice(2);
  
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
    
    const success = await applyMigration(migrationPath, filename);
    if (success) {
      markMigrationAsApplied(filename);
      console.log(`\n✅ Migration ${filename} completed successfully!`);
    } else {
      console.error(`\n❌ Failed to apply ${filename}`);
      console.log(`\n📋 Please run this SQL manually in Supabase SQL Editor:`);
      console.log('='.repeat(60));
      console.log(fs.readFileSync(migrationPath, 'utf8'));
      console.log('='.repeat(60));
      process.exit(1);
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
    
    for (const migration of pending) {
      const success = await applyMigration(migration.path, migration.filename);
      if (success) {
        markMigrationAsApplied(migration.filename);
        console.log(`✅ Migration ${migration.filename} applied successfully\n`);
      } else {
        console.error(`❌ Failed to apply ${migration.filename}`);
        console.log(`\n📋 Please run this SQL manually in Supabase SQL Editor:`);
        console.log('='.repeat(60));
        console.log(fs.readFileSync(migration.path, 'utf8'));
        console.log('='.repeat(60));
        process.exit(1);
      }
    }
    
    console.log('\n✅ All migrations completed successfully!');
  }
}

main().catch(console.error);


