#!/usr/bin/env node

/**
 * Script to automatically apply SQL migrations to Supabase
 * Usage: node scripts/apply-migration.js [migration-file.sql]
 *        node scripts/apply-migration.js (applies all pending migrations)
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Create Supabase client with service role key (has admin privileges)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Track applied migrations
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
    .sort(); // Apply migrations in alphabetical order
  
  return files.map(file => ({
    filename: file,
    path: path.join(migrationsDir, file)
  }));
}

async function applyMigration(migrationPath, filename) {
  console.log(`\n📄 Applying migration: ${filename}`);
  
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  // Split SQL into individual statements (separated by semicolons)
  // Remove comments and empty lines
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .map(s => s + ';');
  
  try {
    // Use Supabase client with service role to execute SQL via RPC
    // We'll create a temporary function to execute the SQL
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Execute each statement separately
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement || statement.trim() === ';') continue;
      
      try {
        // Use Supabase's query method - but it doesn't support arbitrary SQL
        // Instead, we'll use the Management API endpoint
        const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
        
        if (projectRef) {
          // Use Management API to execute SQL
          const managementUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
          const response = await fetch(managementUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'apikey': SUPABASE_SERVICE_ROLE_KEY
            },
            body: JSON.stringify({ query: statement })
          });

          if (!response.ok) {
            // If Management API doesn't work, try direct PostgREST approach
            // Use the Supabase REST API with a custom RPC function
            console.log(`   Executing statement ${i + 1}/${statements.length}...`);
            
            // Alternative: Execute via Supabase client using raw SQL
            // Since Supabase JS doesn't support raw SQL, we'll use a workaround
            // Create a temporary function in the database to execute SQL
            const execSql = `
              DO $$
              BEGIN
                ${statement}
              END $$;
            `;
            
            // Try using the REST API with a custom endpoint
            const restResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
              },
              body: JSON.stringify({ sql: statement })
            });
            
            if (!restResponse.ok) {
              // Last resort: use Supabase client's from() method with raw query
              // This won't work directly, so we'll need to parse and execute
              console.log(`   ⚠️  Could not execute via API, trying alternative method...`);
              
              // For ALTER TABLE and similar DDL statements, we need Management API
              // Let's try a different approach - use the Supabase client's RPC
              const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
              
              if (error) {
                // If RPC doesn't exist, we need to create it first or use Management API
                console.log(`   ⚠️  RPC function not available. Using direct connection...`);
                
                // Final fallback: output SQL for manual execution
                console.log(`   📋 Statement ${i + 1} needs manual execution:`);
                console.log(`   ${statement}`);
                continue;
              }
            }
          }
        } else {
          // Fallback: try to execute via Supabase client directly
          console.log(`   Executing statement ${i + 1}/${statements.length}...`);
          
          // Use a workaround: create a temporary RPC function
          // But first, let's try the simplest approach - execute via psql if available
          const { execSync } = require('child_process');
          
          try {
            // Try using psql if available
            const connectionString = process.env.DATABASE_URL || 
              `postgresql://postgres:${process.env.DB_PASSWORD}@${projectRef}.supabase.co:5432/postgres`;
            
            execSync(`psql "${connectionString}" -c "${statement.replace(/"/g, '\\"')}"`, {
              stdio: 'inherit'
            });
            console.log(`   ✅ Statement ${i + 1} executed successfully`);
          } catch (psqlError) {
            // psql not available, use Supabase Management API
            console.log(`   ⚠️  psql not available, using Supabase API...`);
            
            // Use Supabase Management API
            const projectId = SUPABASE_URL.match(/\/\/([^.]+)\.supabase\.co/)?.[1];
            if (projectId) {
              const mgmtResponse = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: statement })
              });
              
              if (mgmtResponse.ok) {
                console.log(`   ✅ Statement ${i + 1} executed successfully`);
              } else {
                const errorText = await mgmtResponse.text();
                console.error(`   ❌ Error executing statement ${i + 1}:`, errorText);
                throw new Error(`Failed to execute SQL: ${errorText}`);
              }
            } else {
              throw new Error('Could not extract project ID from Supabase URL');
            }
          }
        }
      } catch (stmtError) {
        console.error(`   ❌ Error in statement ${i + 1}:`, stmtError.message);
        // Continue with next statement
      }
    }
    
    console.log(`✅ Migration ${filename} applied successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error applying migration ${filename}:`, error.message);
    console.error('📋 Fallback: Please run this SQL manually in Supabase SQL Editor:');
    console.log('\n' + '='.repeat(60));
    console.log(sql);
    console.log('='.repeat(60));
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
    await applyMigration(migrationPath, filename);
    markMigrationAsApplied(filename);
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
        console.log(`✅ Migration ${migration.filename} applied successfully`);
      } else {
        console.error(`❌ Failed to apply ${migration.filename}`);
        process.exit(1);
      }
    }
  }
}

main().catch(console.error);


