/**
 * Notion API client wrapper
 * Handles versioning, rate limiting, retries, and pagination
 */

import { decryptString } from './encryption';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const DEFAULT_NOTION_VERSION = '2025-09-03';

export interface NotionClientConfig {
  accessToken: string;
  notionVersion?: string;
}

export interface NotionPage {
  id: string;
  url: string;
  properties: Record<string, any>;
  parent: {
    type: 'database_id' | 'data_source_id' | 'page_id' | 'workspace';
    database_id?: string;
    data_source_id?: string;
    page_id?: string;
    workspace?: boolean;
  };
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  [key: string]: any;
}

export interface NotionBlock {
  id: string;
  type: string;
  object: 'block';
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  archived: boolean;
  [key: string]: any;
}

export interface NotionDatabase {
  id: string;
  title: Array<{ plain_text: string }>;
  properties: Record<string, any>;
  parent: {
    type: 'database_id' | 'data_source_id' | 'page_id' | 'workspace';
    database_id?: string;
    data_source_id?: string;
    page_id?: string;
    workspace?: boolean;
  };
  data_sources?: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  [key: string]: any;
}

export interface NotionListResponse<T> {
  object: 'list';
  results: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export class NotionAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'NotionAPIError';
  }
}

/**
 * Create a Notion API client
 */
export function createNotionClient(config: NotionClientConfig) {
  const notionVersion = config.notionVersion || process.env.NOTION_VERSION || DEFAULT_NOTION_VERSION;
  
  /**
   * Make a request to Notion API with retries and rate limiting
   */
  async function request<T>(
    method: string,
    path: string,
    body?: any,
    options: { retries?: number; retryAfter?: number } = {}
  ): Promise<T> {
    const url = `${NOTION_API_BASE}${path}`;
    const maxRetries = options.retries ?? 3;
    let retryAfter = options.retryAfter;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${config.accessToken}`,
          'Notion-Version': notionVersion,
          'Content-Type': 'application/json',
        };
        
        const fetchOptions: RequestInit = {
          method,
          headers,
        };
        
        if (body && (method === 'POST' || method === 'PATCH')) {
          fetchOptions.body = JSON.stringify(body);
        }
        
        const response = await fetch(url, fetchOptions);
        
        // Handle rate limiting (429)
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get('Retry-After');
          retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : Math.pow(2, attempt) * 1000;
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            continue;
          }
          
          throw new NotionAPIError(
            'Rate limit exceeded',
            429,
            'rate_limit_exceeded',
            retryAfter
          );
        }
        
        // Handle 5xx errors with exponential backoff
        if (response.status >= 500 && attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }
        
        // Handle other errors
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new NotionAPIError(
            errorData.message || `Notion API error: ${response.statusText}`,
            response.status,
            errorData.code
          );
        }
        
        return await response.json();
      } catch (error) {
        if (error instanceof NotionAPIError) {
          throw error;
        }
        
        // Network errors - retry with exponential backoff
        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }
        
        throw new Error(`Notion API request failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    throw new Error('Notion API request failed after retries');
  }
  
  /**
   * Get a page by ID
   */
  async function getPage(pageId: string): Promise<NotionPage> {
    return request<NotionPage>('GET', `/pages/${pageId}`);
  }
  
  /**
   * Create a page
   */
  async function createPage(pageData: {
    parent: { database_id?: string; data_source_id?: string };
    properties: Record<string, any>;
    children?: NotionBlock[];
  }): Promise<NotionPage> {
    return request<NotionPage>('POST', '/pages', pageData);
  }
  
  /**
   * Update a page
   */
  async function updatePage(pageId: string, properties: Record<string, any>): Promise<NotionPage> {
    return request<NotionPage>('PATCH', `/pages/${pageId}`, { properties });
  }
  
  /**
   * Get database by ID (may return data sources)
   */
  async function getDatabase(databaseId: string): Promise<NotionDatabase> {
    return request<NotionDatabase>('GET', `/databases/${databaseId}`);
  }
  
  /**
   * Get blocks children with pagination
   */
  async function getBlockChildren(
    blockId: string,
    startCursor?: string
  ): Promise<NotionListResponse<NotionBlock>> {
    const path = `/blocks/${blockId}/children${startCursor ? `?start_cursor=${startCursor}` : ''}`;
    return request<NotionListResponse<NotionBlock>>('GET', path);
  }
  
  /**
   * Get all blocks children (handles pagination automatically)
   */
  async function getAllBlockChildren(blockId: string): Promise<NotionBlock[]> {
    const allBlocks: NotionBlock[] = [];
    let cursor: string | undefined;
    
    do {
      const response = await getBlockChildren(blockId, cursor);
      allBlocks.push(...response.results);
      cursor = response.next_cursor || undefined;
    } while (cursor);
    
    return allBlocks;
  }
  
  /**
   * Query a database or data source
   */
  async function queryDatabase(
    databaseId: string,
    filter?: any,
    sorts?: any[],
    startCursor?: string
  ): Promise<NotionListResponse<NotionPage>> {
    const body: any = {};
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    if (startCursor) body.start_cursor = startCursor;
    
    return request<NotionListResponse<NotionPage>>('POST', `/databases/${databaseId}/query`, body);
  }
  
  /**
   * Resolve parent (database or data source)
   * Handles the data_sources migration from Notion API 2025-09-03
   */
  async function resolveParent(
    parentType: 'database' | 'data_source',
    parentId: string
  ): Promise<{ type: 'database' | 'data_source'; id: string }> {
    if (parentType === 'data_source') {
      return { type: 'data_source', id: parentId };
    }
    
    // For database, check if it has data sources
    try {
      const database = await getDatabase(parentId);
      
      // If database has data_sources, return the first one (or allow selection)
      if (database.data_sources && database.data_sources.length > 0) {
        // Default to first data source
        return { type: 'data_source', id: database.data_sources[0].id };
      }
      
      // Otherwise, use database directly
      return { type: 'database', id: parentId };
    } catch (error) {
      // If database fetch fails, fall back to database_id
      return { type: 'database', id: parentId };
    }
  }
  
  return {
    request,
    getPage,
    createPage,
    updatePage,
    getDatabase,
    getBlockChildren,
    getAllBlockChildren,
    queryDatabase,
    resolveParent,
  };
}

/**
 * Get Notion client for a user
 * Loads encrypted token from database and creates client
 */
export async function getNotionClientForUser(userEmail: string) {
  const { supabase } = await import('../supabase');
  const { decryptString } = await import('./encryption');
  
  // Get connection (assuming user has one active connection for now)
  const { data: connection, error } = await supabase
    .from('notion_connections')
    .select('*')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !connection) {
    throw new Error('Notion not connected. Please connect your Notion account first.');
  }
  
  // Decrypt access token
  const accessToken = decryptString(connection.access_token_enc);
  
  return createNotionClient({ accessToken });
}

