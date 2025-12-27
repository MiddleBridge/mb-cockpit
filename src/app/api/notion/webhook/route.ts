import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { decryptString } from '@/lib/notion/encryption';

/**
 * Notion webhook endpoint
 * POST /api/notion/webhook
 * 
 * Handles:
 * 1. Verification flow (one-time verification_token)
 * 2. Event deliveries with signature validation
 */
export const runtime = 'nodejs'; // Required for crypto operations

export async function POST(request: NextRequest) {
  try {
    // Get raw body bytes for signature verification
    const rawBody = await request.arrayBuffer();
    const rawBodyBytes = Buffer.from(rawBody);
    const rawBodyString = rawBodyBytes.toString('utf8');
    
    // Parse JSON payload
    let payload: any;
    try {
      payload = JSON.parse(rawBodyString);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }
    
    // Handle verification flow
    if (payload.type === 'verification' && payload.verification_token) {
      const subscriptionId = payload.subscription_id;
      const verificationToken = payload.verification_token;
      
      if (!subscriptionId) {
        return NextResponse.json(
          { error: 'Missing subscription_id in verification request' },
          { status: 400 }
        );
      }
      
      // Find the notion_links record by subscription_id
      const { data: link, error: linkError } = await supabase
        .from('notion_links')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .single();
      
      if (linkError || !link) {
        // If link not found, store verification token temporarily
        // In production, you might want to create a pending_subscriptions table
        console.warn(`Verification token received for unknown subscription: ${subscriptionId}`);
        return NextResponse.json({ challenge: verificationToken }, { status: 200 });
      }
      
      // Encrypt and store verification token
      const { encryptString } = await import('@/lib/notion/encryption');
      const verificationTokenEnc = encryptString(verificationToken);
      
      const { error: updateError } = await supabase
        .from('notion_links')
        .update({ verification_token_enc: verificationTokenEnc })
        .eq('id', link.id);
      
      if (updateError) {
        console.error('Error storing verification token:', updateError);
        return NextResponse.json(
          { error: 'Failed to store verification token' },
          { status: 500 }
        );
      }
      
      // Return challenge for verification
      return NextResponse.json({ challenge: verificationToken }, { status: 200 });
    }
    
    // Handle event deliveries
    if (payload.type === 'event') {
      const signature = request.headers.get('X-Notion-Signature');
      
      if (!signature) {
        return NextResponse.json(
          { error: 'Missing X-Notion-Signature header' },
          { status: 401 }
        );
      }
      
      const subscriptionId = payload.subscription_id;
      if (!subscriptionId) {
        return NextResponse.json(
          { error: 'Missing subscription_id in event payload' },
          { status: 400 }
        );
      }
      
      // Find notion_links record to get verification token
      const { data: link, error: linkError } = await supabase
        .from('notion_links')
        .select('verification_token_enc')
        .eq('subscription_id', subscriptionId)
        .single();
      
      if (linkError || !link || !link.verification_token_enc) {
        console.error('Unknown subscription or missing verification token:', subscriptionId);
        return NextResponse.json(
          { error: 'Unknown subscription or missing verification token' },
          { status: 401 }
        );
      }
      
      // Decrypt verification token
      const verificationToken = decryptString(link.verification_token_enc);
      
      // Compute expected signature
      const hmac = crypto.createHmac('sha256', verificationToken);
      hmac.update(rawBodyBytes);
      const expectedSignature = hmac.digest('hex');
      
      // Compare signatures using timing-safe comparison
      const providedSignature = signature.replace('v1=', ''); // Notion may prefix with v1=
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(providedSignature)
      );
      
      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
      
      // Signature is valid - process events
      const events = payload.events || [];
      const pageIds = new Set<string>();
      
      // Extract page IDs from events
      for (const event of events) {
        if (event.object === 'page' && event.id) {
          pageIds.add(event.id);
        }
      }
      
      // Enqueue sync jobs for each affected page
      if (pageIds.size > 0) {
        const { data: linkData } = await supabase
          .from('notion_links')
          .select('user_email, mb_entity_type, mb_entity_id')
          .eq('subscription_id', subscriptionId)
          .single();
        
        if (linkData) {
          const jobs = Array.from(pageIds).map(pageId => ({
            user_email: linkData.user_email,
            job_type: 'sync_page',
            notion_page_id: pageId,
            mb_entity_type: linkData.mb_entity_type,
            mb_entity_id: linkData.mb_entity_id,
            status: 'pending',
            next_run_at: new Date().toISOString(),
          }));
          
          // Upsert jobs (avoid duplicates within 60 seconds)
          for (const job of jobs) {
            await supabase
              .from('notion_jobs')
              .upsert(job, {
                onConflict: 'user_email,notion_page_id',
                ignoreDuplicates: false,
              })
              .catch(err => console.error('Error enqueueing job:', err));
          }
        }
      }
      
      // Log audit event (metadata only, no secrets)
      await supabase
        .from('notion_audit_events')
        .insert({
          user_email: linkData?.user_email || 'unknown',
          event_type: 'webhook_received',
          notion_page_id: Array.from(pageIds)[0] || null,
          metadata: {
            subscription_id: subscriptionId,
            event_count: events.length,
            page_count: pageIds.size,
          },
        })
        .catch(err => console.error('Failed to log audit event:', err));
      
      // Acknowledge quickly
      return NextResponse.json({ received: true }, { status: 200 });
    }
    
    // Unknown payload type
    return NextResponse.json(
      { error: 'Unknown payload type' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error processing Notion webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

