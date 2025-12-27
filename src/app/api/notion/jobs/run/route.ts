import { NextRequest, NextResponse } from 'next/server';
import { getNotionClientForUser } from '@/lib/notion/client';
import { blocksToMarkdown, extractPageTitle } from '@/lib/notion/blocksToMarkdown';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

/**
 * Job worker endpoint for syncing Notion pages
 * POST /api/notion/jobs/run
 * 
 * This should be called by a cron job (Vercel Cron or similar)
 * Processes pending and retry jobs, respecting rate limits
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add service role key check for security
    const serviceRoleKey = request.headers.get('x-service-role-key');
    const expectedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (expectedKey && serviceRoleKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const maxJobsPerRun = parseInt(process.env.NOTION_MAX_JOBS_PER_RUN || '10', 10);
    const now = new Date().toISOString();
    
    // Fetch pending/retry jobs ready to run
    const { data: jobs, error: jobsError } = await supabase
      .from('notion_jobs')
      .select('*')
      .in('status', ['pending', 'retry'])
      .lte('next_run_at', now)
      .order('next_run_at', { ascending: true })
      .limit(maxJobsPerRun);
    
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return NextResponse.json(
        { error: 'Failed to fetch jobs', details: jobsError.message },
        { status: 500 }
      );
    }
    
    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No jobs to process',
        processed: 0 
      });
    }
    
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      rateLimited: 0,
    };
    
    // Process jobs sequentially per workspace to respect rate limits
    // Group by user_email to process one workspace at a time
    const jobsByUser = new Map<string, typeof jobs>();
    for (const job of jobs) {
      const userEmail = job.user_email;
      if (!jobsByUser.has(userEmail)) {
        jobsByUser.set(userEmail, []);
      }
      jobsByUser.get(userEmail)!.push(job);
    }
    
    for (const [userEmail, userJobs] of jobsByUser) {
      for (const job of userJobs) {
        try {
          // Mark job as running (optimistic concurrency)
          const { error: updateError } = await supabase
            .from('notion_jobs')
            .update({ 
              status: 'running',
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)
            .eq('status', job.status); // Ensure status hasn't changed
          
          if (updateError) {
            console.warn(`Job ${job.id} already being processed or status changed`);
            continue;
          }
          
          // Process the job
          await syncNotionPage(job);
          
          // Mark as done
          await supabase
            .from('notion_jobs')
            .update({
              status: 'done',
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);
          
          results.succeeded++;
          results.processed++;
        } catch (error: any) {
          results.processed++;
          
          // Check if it's a rate limit error
          if (error instanceof Error && error.message.includes('429')) {
            const retryAfter = (error as any).retryAfter || 60;
            const nextRunAt = new Date(Date.now() + retryAfter * 1000).toISOString();
            
            await supabase
              .from('notion_jobs')
              .update({
                status: 'retry',
                attempts: job.attempts + 1,
                next_run_at: nextRunAt,
                last_error: `Rate limited: retry after ${retryAfter}s`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);
            
            results.rateLimited++;
          } else if (error instanceof Error && error.message.includes('401') || error.message.includes('403')) {
            // Token invalid - mark as failed
            await supabase
              .from('notion_jobs')
              .update({
                status: 'failed',
                last_error: 'Notion token invalid or expired',
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);
            
            results.failed++;
          } else if (error instanceof Error && error.message.includes('404')) {
            // Page deleted - mark link as broken but keep last note
            await supabase
              .from('notion_links')
              .update({
                last_synced_at: new Date().toISOString(),
              })
              .eq('notion_page_id', job.notion_page_id);
            
            await supabase
              .from('notion_jobs')
              .update({
                status: 'done', // Done, but page is gone
                last_error: 'Page not found (may have been deleted)',
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);
            
            results.succeeded++;
          } else {
            // Other error - retry with exponential backoff
            const attempts = job.attempts + 1;
            const maxAttempts = 8;
            
            if (attempts >= maxAttempts) {
              await supabase
                .from('notion_jobs')
                .update({
                  status: 'failed',
                  attempts,
                  last_error: error.message?.substring(0, 500) || 'Unknown error',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', job.id);
              
              results.failed++;
            } else {
              const backoff = Math.pow(2, attempts) * 1000; // Exponential backoff in ms
              const nextRunAt = new Date(Date.now() + backoff).toISOString();
              
              await supabase
                .from('notion_jobs')
                .update({
                  status: 'retry',
                  attempts,
                  next_run_at: nextRunAt,
                  last_error: error.message?.substring(0, 500) || 'Unknown error',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', job.id);
              
              results.failed++; // Will retry later
            }
          }
        }
      }
      
      // Small delay between workspaces to respect rate limits
      if (jobsByUser.size > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error: any) {
    console.error('Error in job worker:', error);
    return NextResponse.json(
      { error: 'Job worker failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Sync a single Notion page
 */
async function syncNotionPage(job: any) {
  const { user_email, notion_page_id, mb_entity_type, mb_entity_id } = job;
  
  // Get Notion client
  const client = await getNotionClientForUser(user_email);
  
  // Fetch page metadata
  const page = await client.getPage(notion_page_id);
  
  // Fetch all blocks
  const blocks = await client.getAllBlockChildren(notion_page_id);
  
  // Convert blocks to markdown
  const { markdown, plaintext } = await blocksToMarkdown(blocks, async (blockId) => {
    return client.getAllBlockChildren(blockId);
  });
  
  // Extract title
  const title = extractPageTitle(page);
  
  // Compute content hash
  const contentHash = crypto.createHash('sha256').update(markdown).digest('hex');
  
  // Check if content has changed
  const { data: existingLink } = await supabase
    .from('notion_links')
    .select('content_hash')
    .eq('user_email', user_email)
    .eq('notion_page_id', notion_page_id)
    .single();
  
  if (existingLink?.content_hash === contentHash) {
    // Content unchanged, just update last_synced_at
    await supabase
      .from('notion_links')
      .update({
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_email', user_email)
      .eq('notion_page_id', notion_page_id);
    
    return; // Skip note update
  }
  
  // Upsert entity_notes
  await supabase
    .from('entity_notes')
    .upsert({
      user_email,
      mb_entity_type: mb_entity_type || 'unknown',
      mb_entity_id: mb_entity_id || notion_page_id, // Fallback to page_id if entity_id missing
      source: 'notion',
      title,
      content_markdown: markdown,
      content_text: plaintext,
      notion_page_id,
      notion_last_edited_time: page.last_edited_time,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_email,notion_page_id',
    });
  
  // Update notion_links
  await supabase
    .from('notion_links')
    .update({
      last_synced_at: new Date().toISOString(),
      content_hash: contentHash,
      updated_at: new Date().toISOString(),
    })
    .eq('user_email', user_email)
    .eq('notion_page_id', notion_page_id);
  
  // Log audit event
  await supabase
    .from('notion_audit_events')
    .insert({
      user_email,
      event_type: 'sync_success',
      notion_page_id,
      mb_entity_type,
      mb_entity_id,
    })
    .catch(err => console.error('Failed to log audit event:', err));
}

